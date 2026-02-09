import Cookies from 'js-cookie';

export interface UserLocation {
  latitude: number;
  longitude: number;
}

const LOCATION_STORAGE_KEY = 'userLocation';
const LOCATION_COOKIE_KEY = 'user_location';
const COOKIE_EXPIRY_DAYS = 30; // 30 días

/**
 * Sistema híbrido de persistencia de ubicación usando localStorage + cookies
 */
export class LocationStorage {
  /**
   * Guarda la ubicación del usuario en localStorage y cookies
   */
  static save(location: UserLocation): void {
    try {
      const locationData = JSON.stringify(location);
      
      // Guardar en localStorage (primera prioridad)
      if (typeof window !== 'undefined') {
        localStorage.setItem(LOCATION_STORAGE_KEY, locationData);
        console.log('📍 Ubicación guardada en localStorage:', location);
      }
      
      // Guardar en cookies (backup robusto)
      Cookies.set(LOCATION_COOKIE_KEY, locationData, { 
        expires: COOKIE_EXPIRY_DAYS,
        sameSite: 'strict',
        secure: process.env.NODE_ENV === 'production'
      });
      console.log('🍪 Ubicación guardada en cookies:', location);
      
    } catch (error) {
      console.warn('Error guardando ubicación:', error);
    }
  }

  /**
   * Recupera la ubicación del usuario desde localStorage o cookies
   */
  static load(): UserLocation | null {
    try {
      // Intentar cargar desde localStorage primero
      if (typeof window !== 'undefined') {
        const localStorage_data = localStorage.getItem(LOCATION_STORAGE_KEY);
        if (localStorage_data) {
          const location = JSON.parse(localStorage_data);
          console.log('📍 Ubicación recuperada desde localStorage:', location);
          return location;
        }
      }
      
      // Fallback: intentar cargar desde cookies
      const cookieData = Cookies.get(LOCATION_COOKIE_KEY);
      if (cookieData) {
        const location = JSON.parse(cookieData);
        console.log('🍪 Ubicación recuperada desde cookies:', location);
        
        // Sincronizar de vuelta a localStorage si está disponible
        if (typeof window !== 'undefined') {
          localStorage.setItem(LOCATION_STORAGE_KEY, cookieData);
          console.log('🔄 Ubicación sincronizada a localStorage desde cookies');
        }
        
        return location;
      }
      
    } catch (error) {
      console.warn('Error cargando ubicación:', error);
    }
    
    return null;
  }

  /**
   * Limpia la ubicación guardada de localStorage y cookies
   */
  static clear(): void {
    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem(LOCATION_STORAGE_KEY);
        console.log('📍 Ubicación eliminada de localStorage');
      }
      
      Cookies.remove(LOCATION_COOKIE_KEY);
      console.log('🍪 Ubicación eliminada de cookies');
      
    } catch (error) {
      console.warn('Error limpiando ubicación:', error);
    }
  }

  /**
   * Verifica si hay una ubicación guardada
   */
  static hasStoredLocation(): boolean {
    return LocationStorage.load() !== null;
  }

  /**
   * Obtiene la antigüedad de la ubicación guardada (en minutos)
   * Returns null si no hay ubicación o no se puede determinar la fecha
   */
  static getLocationAge(): number | null {
    try {
      // Las cookies no tienen timestamp directo, usar localStorage para esto
      if (typeof window !== 'undefined') {
        const timestamp = localStorage.getItem(LOCATION_STORAGE_KEY + '_timestamp');
        if (timestamp) {
          const savedTime = parseInt(timestamp);
          const currentTime = Date.now();
          return Math.floor((currentTime - savedTime) / 60000); // minutos
        }
      }
    } catch (error) {
      console.warn('Error obteniendo edad de ubicación:', error);
    }
    return null;
  }

  /**
   * Guarda la ubicación con timestamp
   */
  static saveWithTimestamp(location: UserLocation): void {
    LocationStorage.save(location);
    
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(LOCATION_STORAGE_KEY + '_timestamp', Date.now().toString());
        console.log('⏰ Timestamp de ubicación guardado');
      }
    } catch (error) {
      console.warn('Error guardando timestamp de ubicación:', error);
    }
  }
}