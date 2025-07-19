
interface GeocodeResult {
  address: string;
  success: boolean;
}

export const reverseGeocode = async (latitude: number, longitude: number): Promise<GeocodeResult> => {
  try {
    console.log('🌍 Fazendo geocodificação reversa para:', { latitude, longitude });
    
    // Usar Nominatim (OpenStreetMap) como serviço gratuito
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1`,
      {
        headers: {
          'User-Agent': 'TCPonto-App/1.0'
        }
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    
    if (data && data.display_name) {
      console.log('✅ Geocodificação bem-sucedida:', data.display_name);
      return {
        address: data.display_name,
        success: true
      };
    } else {
      throw new Error('Nenhum endereço encontrado');
    }
  } catch (error) {
    console.warn('⚠️ Erro na geocodificação reversa:', error);
    
    // Fallback: retornar coordenadas formatadas
    return {
      address: `Lat: ${latitude.toFixed(6)}, Lng: ${longitude.toFixed(6)}`,
      success: false
    };
  }
};
