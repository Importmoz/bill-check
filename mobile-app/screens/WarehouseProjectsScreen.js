import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator, Alert, SafeAreaView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PB_URL = 'http://pocketbase-cgk4w0o8koocsg4wggsgg888.144.91.110.199.sslip.io';

export default function WarehouseProjectsScreen({ navigation }) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('pb_token');
      if (!token) throw new Error('Não autenticado');

      // Buscar apenas os ativos. (No PB filter: archived != true ou algo semelhante, mas vamos buscar todos por agora e o utilizador escolhe).
      const response = await fetch(`${PB_URL}/api/collections/confirm_projects/records?sort=-created`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Erro ao carregar projetos');
      
      setProjects(data.items || []);
    } catch (error) {
      Alert.alert('Erro', error.message);
    } finally {
      setLoading(false);
    }
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity 
      style={styles.projectCard}
      onPress={() => navigation.navigate('WarehouseGuides', { project: item })}
    >
      <Text style={styles.projectName}>{item.name}</Text>
      <Text style={styles.projectInfo}>Folha: {item.sheet_id.substring(0, 15)}...</Text>
      <Text style={styles.projectInfo}>Sincronizado: {new Date(item.last_sync).toLocaleDateString()}</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      {loading ? (
        <ActivityIndicator size="large" color="#10B981" style={{marginTop: 50}} />
      ) : (
        <FlatList
          data={projects}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 20 }}
          ListEmptyComponent={<Text style={styles.emptyText}>Nenhum projeto encontrado.</Text>}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  projectCard: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#10B981',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  projectName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  projectInfo: {
    fontSize: 12,
    color: '#6B7280',
  },
  emptyText: {
    textAlign: 'center',
    color: '#6B7280',
    marginTop: 50,
  }
});
