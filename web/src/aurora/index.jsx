/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.
*/

import React from 'react';
import { ThemeProvider } from './theme-provider';
import { Button } from './primitives/button';
import { Card, CardContent } from './primitives/card';
import { Input } from './primitives/input';
import { useThemeStore } from './store/theme-store';
import './tokens/globals.css';

const AuroraShell = () => {
  return (
    <div className='aurora-root'>
      <div className='aurora-shell' data-theme='aurora'>
        <Card className='aurora-card'>
          <CardContent>
            <div className='aurora-stack'>
              <h1 className='aurora-title'>Aurora Theme</h1>
              <p className='aurora-description'>
                当前处于 Aurora 主题运行时。Task-001 已落地主题基础设施。
              </p>
              <div className='aurora-form'>
                <Input defaultValue='欢迎使用 Aurora' />
                <Button>确认</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default function AuroraApp() {
  const theme = useThemeStore((state) => state.theme);

  return (
    <ThemeProvider>
      <div className='aurora-legacy-wrapper'>
        <AuroraShell />
        <div className='aurora-meta'>Current theme: {theme}</div>
      </div>
    </ThemeProvider>
  );
}
