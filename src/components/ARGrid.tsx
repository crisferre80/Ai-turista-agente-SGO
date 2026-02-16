'use client';

import { useMemo } from 'react';
import * as THREE from 'three';

interface ARGridProps {
  size?: number;
  divisions?: number;
  colorCenterLine?: string;
  colorGrid?: string;
  origin?: [number, number, number];
  scale?: number;
  showAxes?: boolean;
}

export default function ARGrid({
  size = 40,
  divisions = 40,
  colorCenterLine = '#00ff00',
  colorGrid = '#004400',
  origin = [0, 0, 0],
  scale = 1,
  showAxes = true
}: ARGridProps) {
  // Extraer valores del array origin para que ESLint pueda analizarlos estáticamente
  const [originX, originY, originZ] = origin;

  const gridHelper = useMemo(() => {
    const helper = new THREE.GridHelper(size, divisions, colorCenterLine, colorGrid);
    helper.position.set(originX, originY, originZ);
    helper.scale.setScalar(scale);
    return helper;
  }, [size, divisions, colorCenterLine, colorGrid, originX, originY, originZ, scale]);

  const axesHelper = useMemo(() => {
    if (!showAxes) return null;
    const helper = new THREE.AxesHelper(5);
    helper.position.set(originX, originY, originZ);
    helper.scale.setScalar(scale);
    return helper;
  }, [showAxes, originX, originY, originZ, scale]);

  return (
    <>
      <primitive object={gridHelper} />
      {axesHelper && <primitive object={axesHelper} />}
    </>
  );
}