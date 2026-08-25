import AsyncStorage from '@react-native-async-storage/async-storage';

export const DEFAULT_PB_URL = 'https://pocketbase.mycloudspaces.com';
export const DEFAULT_API_BASE = 'https://pocketbase.mycloudspaces.com'; // or your Node backend URL

export async function getPocketBaseUrl() {
  try {
    const customPb = await AsyncStorage.getItem('custom_pb_url');
    if (customPb && customPb.trim().length > 0) {
      return formatUrl(customPb);
    }
  } catch (e) {}
  return DEFAULT_PB_URL;
}

export async function getApiBaseUrl() {
  try {
    const customApi = await AsyncStorage.getItem('custom_api_url');
    if (customApi && customApi.trim().length > 0) {
      return formatUrl(customApi);
    }
  } catch (e) {}
  return DEFAULT_API_BASE;
}

export async function saveServerConfig({ pbUrl, apiUrl }) {
  try {
    if (pbUrl) await AsyncStorage.setItem('custom_pb_url', formatUrl(pbUrl));
    if (apiUrl) await AsyncStorage.setItem('custom_api_url', formatUrl(apiUrl));
  } catch (e) {
    console.error('Error saving server config:', e);
  }
}

export function formatUrl(url) {
  if (!url) return '';
  let clean = url.trim().replace(/\/$/, '');
  if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
    clean = 'https://' + clean;
  }
  return clean;
}
