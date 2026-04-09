import React from 'react';
import { Badge } from '../../../primitives/badge';
import { CHANNEL_OPTIONS } from '../../../../constants/channel.constants';

const resolveLabel = (platform = '') => {
  const option = CHANNEL_OPTIONS.find((item) => String(item.value) === String(platform));
  if (option) return option.label;
  if (!platform) return '';
  return String(platform);
};

const PlatformBadge = ({ platform, children, variant = 'secondary', ...props }) => {
  const label = resolveLabel(platform) || children;

  return (
    <Badge variant={variant} {...props}>
      {label}
    </Badge>
  );
};

export default PlatformBadge;
