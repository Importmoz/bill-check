import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function MenuScreen({ navigation }) {

  const handleLogout = async () => {
    Alert.alert('Terminar Sessão', 'Tem a certeza que deseja sair?', [
      { text: 'Cancelar', style: 'cancel' },
      { 
        text: 'Sair', 
        style: 'destructive',
        onPress: async () => {
          await AsyncStorage.removeItem('pb_token');
          await AsyncStorage.removeItem('pb_user');
          navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
        }
      }
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Módulos</Text>
        <Text style={styles.subtitle}>Selecione a operação</Text>
      </View>

      <View style={styles.menu}>
        <TouchableOpacity 
          style={[styles.menuCard, { borderLeftColor: '#9333EA' }]} 
          onPress={() => navigation.navigate('Upload')}
        >
          <View style={styles.iconPlaceholder}>
            <Text style={styles.iconText}>📄</Text>
          </View>
          <View style={styles.menuTextContainer}>
            <Text style={styles.menuTitle}>Extractos Bancários</Text>
            <Text style={styles.menuDesc}>Fazer upload e reconciliar pagamentos</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.menuCard, { borderLeftColor: '#10B981' }]} 
          onPress={() => navigation.navigate('WarehouseProjects')}
        >
          <View style={styles.iconPlaceholder}>
            <Text style={styles.iconText}>📦</Text>
          </View>
          <View style={styles.menuTextContainer}>
            <Text style={styles.menuTitle}>Armazém e Entregas</Text>
            <Text style={styles.menuDesc}>Confirmar entregas e tirar fotos de guias</Text>
          </View>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Text style={styles.logoutBtnText}>Terminar Sessão</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    padding: 20,
  },
  header: {
    marginTop: 40,
    marginBottom: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: '900',
    color: '#111827',
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  menu: {
    flex: 1,
    gap: 20,
  },
  menuCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderLeftWidth: 6,
  },
  iconPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  iconText: {
    fontSize: 24,
  },
  menuTextContainer: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
  },
  menuDesc: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  logoutBtn: {
    padding: 20,
    alignItems: 'center',
  },
  logoutBtnText: {
    color: '#EF4444',
    fontWeight: 'bold',
    fontSize: 16,
  }
});
