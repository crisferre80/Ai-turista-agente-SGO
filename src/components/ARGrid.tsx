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
  const gridHelper = useMemo(() => {
    const helper = new THREE.GridHelper(size, divisions, colorCenterLine, colorGrid);
    helper.position.set(origin[0], origin[1], origin[2]);
    helper.scale.setScalar(scale);
    return helper;
  }, [size, divisions, colorCenterLine, colorGrid, origin[0], origin[1], origin[2], scale]);

  const axesHelper = useMemo(() => {
    if (!showAxes) return null;
    const helper = new THREE.AxesHelper(5);
    helper.position.set(origin[0], origin[1], origin[2]);
    helper.scale.setScalar(scale);
    return helper;
  }, [showAxes, origin[0], origin[1], origin[2], scale]);

  return (
    <>
      <primitive object={gridHelper} />
      {axesHelper && <primitive object={axesHelper} />}
    </>
  );
}