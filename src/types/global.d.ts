declare global {
  interface Window {
    santiSpeak?: (text: string) => void;
    santiNarrate?: (text: string) => void;
    focusPlaceOnMap?: (place: string) => void;
    requestRoute?: (lng: number, lat: number, name: string) => void;
  }
}

export {};