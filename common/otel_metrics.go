package common

import (
	"context"
	"fmt"
	"strings"
	"time"

	runtimeinstrumentation "go.opentelemetry.io/contrib/instrumentation/runtime"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	otlpmetrichttp "go.opentelemetry.io/otel/exporters/otlp/otlpmetric/otlpmetrichttp"
	sdkmetric "go.opentelemetry.io/otel/sdk/metric"
	"go.opentelemetry.io/otel/sdk/resource"
	semconv "go.opentelemetry.io/otel/semconv/v1.37.0"
)

func resolveOTLPMetricsEndpoint() string {
	endpoint := GetEnvOrDefaultString("OTEL_EXPORTER_OTLP_METRICS_ENDPOINT", "")
	if endpoint != "" {
		return endpoint
	}

	baseEndpoint := GetEnvOrDefaultString("OTEL_EXPORTER_OTLP_ENDPOINT", "")
	if baseEndpoint == "" {
		return ""
	}

	return strings.TrimRight(baseEndpoint, "/") + "/v1/metrics"
}

func resolveMetricsExportInterval() time.Duration {
	rawInterval := GetEnvOrDefaultString("OTEL_METRIC_EXPORT_INTERVAL", "30s")
	exportInterval, err := time.ParseDuration(rawInterval)
	if err != nil || exportInterval <= 0 {
		return 30 * time.Second
	}

	return exportInterval
}

func buildMetricsResource(ctx context.Context, serviceName string) (*resource.Resource, error) {
	return resource.New(
		ctx,
		resource.WithAttributes(
			semconv.ServiceName(serviceName),
			attribute.String(
				"deployment.environment.name",
				GetEnvOrDefaultString("OTEL_DEPLOYMENT_ENV", "prod"),
			),
			attribute.String(
				"app.name",
				GetEnvOrDefaultString("OTEL_APP_NAME", serviceName),
			),
		),
	)
}

func StartOTELRuntimeMetrics() (func(context.Context) error, error) {
	if GetEnvOrDefaultString("OTEL_RUNTIME_METRICS_ENABLED", "true") == "false" {
		return nil, nil
	}

	endpoint := resolveOTLPMetricsEndpoint()
	if endpoint == "" {
		return nil, nil
	}

	ctx := context.Background()
	serviceName := GetEnvOrDefaultString("OTEL_SERVICE_NAME", "one-api")

	exporter, err := otlpmetrichttp.New(ctx, otlpmetrichttp.WithEndpointURL(endpoint))
	if err != nil {
		return nil, fmt.Errorf("create otlp metric exporter: %w", err)
	}

	metricsResource, err := buildMetricsResource(ctx, serviceName)
	if err != nil {
		return nil, fmt.Errorf("build metric resource: %w", err)
	}

	reader := sdkmetric.NewPeriodicReader(
		exporter,
		sdkmetric.WithInterval(resolveMetricsExportInterval()),
	)
	meterProvider := sdkmetric.NewMeterProvider(
		sdkmetric.WithReader(reader),
		sdkmetric.WithResource(metricsResource),
	)

	otel.SetMeterProvider(meterProvider)

	err = runtimeinstrumentation.Start(
		runtimeinstrumentation.WithMeterProvider(meterProvider),
		runtimeinstrumentation.WithMinimumReadMemStatsInterval(5*time.Second),
	)
	if err != nil {
		_ = meterProvider.Shutdown(ctx)
		return nil, fmt.Errorf("start runtime instrumentation: %w", err)
	}

	SysLog(fmt.Sprintf("otel runtime metrics enabled, endpoint=%s", endpoint))
	return meterProvider.Shutdown, nil
}
