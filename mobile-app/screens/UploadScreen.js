import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, TouchableOpacity, Alert, ActivityIndicator, TextInput, ScrollView, Platform } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { File, UploadType } from 'expo-file-system';
import { useState, useEffect } from 'react';

export default function UploadScreen() {
  const [serverIP, setServerIP] = useState('m447cyfq0dvffd1xwstwi1ca.144.91.110.199.sslip.io');
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  
  const [connStatus, setConnStatus] = useState('checking'); // 'checking', 'ok', 'error'
  const [isCheckingConn, setIsCheckingConn] = useState(false);

  const formatUrl = (ip) => {
    let cleanIp = ip.trim().replace(/\/$/, '');
    if (!cleanIp.startsWith('http://') && !cleanIp.startsWith('https://')) {
      cleanIp = 'http://' + cleanIp;
    }
    return cleanIp;
  };

  const testConnection = async (ip, silent = false) => {
    if (!ip) return;
    if (!silent) setIsCheckingConn(true);
    if (connStatus !== 'ok' && !silent) setConnStatus('checking');
    
    try {
      const response = await fetch(`${formatUrl(ip)}/api/version`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
      });
      
      if (response.ok) {
        setConnStatus('ok');
      } else {
        setConnStatus('error');
      }
    } catch (error) {
      setConnStatus('error');
    } finally {
      if (!silent) setIsCheckingConn(false);
    }
  };

  // Polling em tempo real (a cada 5 segundos)
  useEffect(() => {
    testConnection(serverIP);
    
    const interval = setInterval(() => {
      if (!uploading) { // Evita sobrecarregar a rede enquanto faz upload
        testConnection(serverIP, true);
      }
    }, 5000);
    
    return () => clearInterval(interval);
  }, [serverIP, uploading]);

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setFile(result.assets[0]);
        setResult(null);
      }
    } catch (err) {
      console.error(err);
      Alert.alert('Erro', 'Ocorreu um erro ao selecionar o ficheiro.');
    }
  };

  const uploadFile = async () => {
    if (!file) {
      Alert.alert('Aviso', 'Por favor, selecione um ficheiro primeiro.');
      return;
    }

    if (connStatus !== 'ok') {
      Alert.alert('Sem Ligação', 'Não consegue comunicar com o servidor.');
      return;
    }

    setUploading(true);
    setResult(null);

    try {
      const uploadUrl = `${formatUrl(serverIP)}/api/bank/upload`;
      
      const fileToUpload = new File(file.uri);
      const response = await fileToUpload.upload(uploadUrl, {
        fieldName: 'file',
        httpMethod: 'POST',
        uploadType: UploadType.MULTIPART,
      });

      let data;
      try {
        data = JSON.parse(response.body);
      } catch(e) {
        throw new Error('O servidor retornou um formato inválido. Provavelmente ocorreu um erro no processamento do ficheiro.');
      }

      // FileSystem devolve o status numerical
      if (response.status >= 200 && response.status < 300) {
        let newCount = 0;
        let dupCount = 0;
        
        try {
          // 1. Obter o URL do PocketBase a partir do servidor
          const configRes = await fetch(`${formatUrl(serverIP)}/config.js`);
          const configText = await configRes.text();
          const pbUrlMatch = configText.match(/"POCKETBASE_URL":\s*"([^"]+)"/);
          const pbUrl = pbUrlMatch ? pbUrlMatch[1] : 'http://pocketbase-cgk4w0o8koocsg4wggsgg888.144.91.110.199.sslip.io';

          // 2. Iterar sobre os movimentos e gravar
          if (data && data.length > 0) {
            for (const item of data) {
              try {
                // Verificar duplicado
                const searchRes = await fetch(`${pbUrl}/api/collections/bank_incomes/records?filter=signature="${item.signature}"`);
                const searchData = await searchRes.json();
                
                if (searchData.items && searchData.items.length > 0) {
                  dupCount++;
                } else {
                  // Inserir novo
                  const insertRes = await fetch(`${pbUrl}/api/collections/bank_incomes/records`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(item)
                  });
                  if (insertRes.ok) {
                    newCount++;
                  } else {
                    console.warn('Falha ao inserir', await insertRes.text());
                  }
                }
              } catch (err) {
                console.warn('Erro ao processar item', err);
              }
            }
          }
        } catch (e) {
          console.warn('Erro ao ligar ao PocketBase', e);
        }

        const summary = `Processado: ${data.length} movs.\nNovos: ${newCount}\nDuplicados: ${dupCount}`;
        setResult(summary);
        
        // Esconder o relatório após 5 segundos
        setTimeout(() => setResult(null), 5000);

        Alert.alert('Sucesso', `Extracto processado!\n\nMovimentos totais: ${data.length}\nNovos inseridos: ${newCount}\nDuplicados ignorados: ${dupCount}`);
        setFile(null); 
      } else {
        setResult(`Erro: ${data.error || 'Falha ao processar.'}`);
        Alert.alert('Erro do Servidor', data.error || 'Falha ao processar o ficheiro.');
      }
    } catch (error) {
      console.error(error);
      setResult(`Erro de envio: ${error.message}`);
      Alert.alert('Erro de Envio', `Falha ao enviar o ficheiro: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <StatusBar style="auto" />
      
      {/* Top Bar Real-Time Status */}
      <View style={styles.topBar}>
        <View style={styles.statusBadge}>
          <View style={[
            styles.statusDot, 
            connStatus === 'ok' ? styles.statusDotOk : 
            connStatus === 'error' ? styles.statusDotError : 
            styles.statusDotChecking
          ]} />
          <Text style={[
            styles.statusText,
            connStatus === 'ok' ? styles.statusTextOk : 
            connStatus === 'error' ? styles.statusTextError : 
            styles.statusTextChecking
          ]}>
            {connStatus === 'ok' ? 'LIGADO' : connStatus === 'error' ? 'SEM LIGAÇÃO' : 'A LIGAR...'}
          </Text>
        </View>
      </View>

      <View style={styles.header}>
        <Text style={styles.title}>BillCheck</Text>
        <Text style={styles.subtitle}>Upload de Extractos</Text>
      </View>

      {/* Só mostra o cartão do servidor se não estiver ligado com sucesso */}
      {connStatus !== 'ok' && (
        <View style={styles.card}>
          <View style={styles.ipHeader}>
            <Text style={styles.label}>Configuração do Servidor</Text>
          </View>

          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={serverIP}
              onChangeText={setServerIP}
              placeholder="ex: m447cyfq0dvffd1xwstwi1ca..."
              keyboardType="url"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity 
              style={styles.testBtn} 
              onPress={() => testConnection(serverIP)}
              disabled={isCheckingConn}
            >
              {isCheckingConn ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.testBtnText}>Testar</Text>
              )}
            </TouchableOpacity>
          </View>

          {connStatus === 'error' && (
            <Text style={styles.errorHint}>O servidor não está a responder. Verifique se o endereço está correto e se tem ligação à Internet.</Text>
          )}
        </View>
      )}

      {/* Cartão de Upload - Oculta/Desativa levemente se não houver ligação */}
      <View style={[styles.uploadSection, connStatus !== 'ok' && styles.uploadSectionDisabled]}>
        <TouchableOpacity 
          style={styles.pickButton} 
          onPress={pickDocument} 
          disabled={uploading || connStatus !== 'ok'}
        >
          <Text style={styles.pickButtonText}>
            {file ? 'Trocar Ficheiro' : 'Selecionar Extracto (.xlsx, .txt)'}
          </Text>
        </TouchableOpacity>

        {file && (
          <View style={styles.fileInfo}>
            <Text style={styles.fileName} numberOfLines={1} ellipsizeMode="middle">
              {file.name}
            </Text>
            <Text style={styles.fileSize}>
              {file.size ? (file.size / 1024).toFixed(2) + ' KB' : 'Tamanho desconhecido'}
            </Text>
          </View>
        )}

        <TouchableOpacity 
          style={[styles.uploadButton, (!file || uploading || connStatus !== 'ok') && styles.uploadButtonDisabled]} 
          onPress={uploadFile}
          disabled={!file || uploading || connStatus !== 'ok'}
        >
          {uploading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.uploadButtonText}>Enviar para o Servidor</Text>
          )}
        </TouchableOpacity>
      </View>

      {result && (
        <View style={styles.resultContainer}>
          <Text style={[styles.resultText, result.startsWith('Erro') && styles.resultTextError]}>
            {result}
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#F3F4F6',
    padding: 20,
    justifyContent: 'center',
  },
  topBar: {
    alignItems: 'center',
    marginBottom: 20,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusDotOk: { backgroundColor: '#10B981', shadowColor: '#10B981', shadowOpacity: 0.5, shadowRadius: 4 },
  statusDotError: { backgroundColor: '#EF4444' },
  statusDotChecking: { backgroundColor: '#F59E0B' },
  statusText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  statusTextOk: { color: '#059669' },
  statusTextError: { color: '#DC2626' },
  statusTextChecking: { color: '#D97706' },
  header: {
    marginBottom: 30,
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: '900',
    color: '#9333EA',
    textTransform: 'uppercase',
    letterSpacing: -1,
  },
  subtitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginTop: 4,
  },
  card: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  ipHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  label: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#4B5563',
    textTransform: 'uppercase',
  },
  inputRow: {
    flexDirection: 'row',
    gap: 10,
  },
  input: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 15,
    fontSize: 14,
    fontWeight: 'bold',
    color: '#111827',
  },
  testBtn: {
    backgroundColor: '#4F46E5',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 15,
    borderRadius: 12,
  },
  testBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 12,
    textTransform: 'uppercase',
  },
  errorHint: {
    fontSize: 11,
    color: '#DC2626',
    marginTop: 10,
    backgroundColor: '#FEF2F2',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  uploadSection: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  uploadSectionDisabled: {
    opacity: 0.5,
  },
  pickButton: {
    backgroundColor: '#F3E8FF',
    padding: 15,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#D8B4FE',
    borderStyle: 'dashed',
    alignItems: 'center',
    marginBottom: 20,
  },
  pickButtonText: {
    color: '#7E22CE',
    fontWeight: 'bold',
    fontSize: 14,
  },
  fileInfo: {
    backgroundColor: '#F9FAFB',
    padding: 15,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  fileName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  fileSize: {
    fontSize: 12,
    color: '#6B7280',
  },
  uploadButton: {
    backgroundColor: '#9333EA',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#A855F7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  uploadButtonDisabled: {
    backgroundColor: '#D1D5DB',
    shadowOpacity: 0,
    elevation: 0,
  },
  uploadButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
    textTransform: 'uppercase',
  },
  resultContainer: {
    marginTop: 20,
    padding: 15,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  resultText: {
    fontSize: 14,
    color: '#059669',
    fontWeight: 'bold',
    textAlign: 'center',
  },
  resultTextError: {
    color: '#DC2626',
  },
});
