"use client";
import React, { useState, useEffect } from 'react';
import Image from 'next/image';

interface WeatherData {
  temp: number;
  description: string;
  icon: string;
  city: string;
}

const WeatherWidget = () => {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchWeather = (lat: number, lon: number) => {
      fetch(`/api/weather?lat=${lat}&lon=${lon}`)
        .then(res => {
          if (!res.ok) {
            return res.json().then(data => {
              throw new Error(data.error || `HTTP ${res.status}: ${res.statusText}`);
            });
          }
          return res.json();
        })
        .then(data => {
          setWeather(data);
          setError(null);
        })
        .catch(err => {
          console.error('❌ Error obteniendo clima:', err);
          setError('No se pudo cargar el clima.');
        })
        .finally(() => setLoading(false));
    };

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          fetchWeather(position.coords.latitude, position.coords.longitude);
        },
        (err) => {
          // Si el usuario niega el permiso, usamos una ubicación por defecto (Santiago del Estero)
          if (err.code === err.PERMISSION_DENIED) {
            console.warn('Permiso de ubicación denegado. Usando ubicación por defecto.');
            // Coordenadas de Santiago del Estero Capital
            fetchWeather(-27.7951, -64.2615);
          } else {
            fetchWeather(-27.7951, -64.2615);
          }
        }
      );
    } else {
      // Fallback para navegadores sin geolocalización
      fetchWeather(-27.7951, -64.2615);
    }
  }, []);

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.text}>Cargando clima...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.container}>
        <div style={styles.text}>☀️ {error}</div>
      </div>
    );
  }

  if (!weather) {
    return null;
  }

  return (
    <div style={styles.container}>
      <Image
        src={`https://openweathermap.org/img/wn/${weather.icon}.png`}
        alt={weather.description}
        width={40}
        height={40}
      />
      <div style={styles.text}>
        <span style={{ fontWeight: 'bold' }}>{Math.round(weather.temp)}°C</span>
        <span style={{ fontSize: '12px', opacity: 0.8 }}>{weather.city}</span>
      </div>
    </div>
  );
};

const styles = {
  container: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    background: 'rgba(255, 255, 255, 0)',
    padding: '2px 4px',
    borderRadius: '20px',
    boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
    backdropFilter: 'blur(5px)',
    border: '1px solid rgba(34, 38, 46, 0.46)',
  },
  text: {
    display: 'flex',
    flexDirection: 'column' as const,
    lineHeight: '1.2',
    color: '#fafafa',
  }
};

export default WeatherWidget;
