import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ActivityIndicator, View } from 'react-native';

// Import Screens
import LoginScreen from './screens/LoginScreen';
import MenuScreen from './screens/MenuScreen';
import UploadScreen from './screens/UploadScreen';
import WarehouseProjectsScreen from './screens/WarehouseProjectsScreen';
import WarehouseGuidesScreen from './screens/WarehouseGuidesScreen';
import WarehouseDetailScreen from './screens/WarehouseDetailScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  const [initialRoute, setInitialRoute] = useState(null);

  useEffect(() => {
    checkToken();
  }, []);

  const checkToken = async () => {
    try {
      const token = await AsyncStorage.getItem('pb_token');
      if (token) {
        setInitialRoute('Menu');
      } else {
        setInitialRoute('Login');
      }
    } catch (error) {
      setInitialRoute('Login');
    }
  };

  if (!initialRoute) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#9333EA" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator 
        initialRouteName={initialRoute}
        screenOptions={{
          headerStyle: { backgroundColor: '#F3F4F6' },
          headerShadowVisible: false,
          headerTintColor: '#111827',
          headerTitleStyle: { fontWeight: 'bold' }
        }}
      >
        <Stack.Screen 
          name="Login" 
          component={LoginScreen} 
          options={{ headerShown: false }} 
        />
        <Stack.Screen 
          name="Menu" 
          component={MenuScreen} 
          options={{ headerShown: false }} 
        />
        <Stack.Screen 
          name="Upload" 
          component={UploadScreen} 
          options={{ title: 'Extractos Bancários' }} 
        />
        <Stack.Screen 
          name="WarehouseProjects" 
          component={WarehouseProjectsScreen} 
          options={{ title: 'Armazém - Projetos' }} 
        />
        <Stack.Screen 
          name="WarehouseGuides" 
          component={WarehouseGuidesScreen} 
          options={{ title: 'Guias Pendentes' }} 
        />
        <Stack.Screen 
          name="WarehouseDetail" 
          component={WarehouseDetailScreen} 
          options={{ title: 'Confirmar Entrega' }} 
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
