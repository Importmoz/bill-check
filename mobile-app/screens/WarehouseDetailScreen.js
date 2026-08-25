import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Alert, ActivityIndicator, SafeAreaView, ScrollView } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { uploadAsync, FileSystemUploadType } from 'expo-file-system/legacy';
import { getApiBaseUrl } from '../config';

function getColumnLetter(colIndex) {
  let letter = '';
  let temp = colIndex;
  while (temp >= 0) {
    letter = String.fromCharCode((temp % 26) + 65) + letter;
    temp = Math.floor(temp / 26) - 1;
  }
  return letter;
}

export default function WarehouseDetailScreen({ route, navigation }) {
  const { project, process } = route.params;
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(false);

  const takePhoto = async () => {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    
    if (permissionResult.granted === false) {
      Alert.alert('Permissão recusada', 'É necessário acesso à câmara para tirar a foto de entrega.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: false, 
      quality: 0.5, 
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      setPhotos([...photos, result.assets[0].uri]);
    }
  };

  const removePhoto = (index) => {
    const newPhotos = [...photos];
    newPhotos.splice(index, 1);
    setPhotos(newPhotos);
  };

  const confirmDelivery = async () => {
    if (photos.length === 0) {
      Alert.alert('Atenção', 'Tem de tirar pelo menos uma foto da mercadoria para confirmar a entrega.');
      return;
    }

    try {
      setLoading(true);
      const apiBase = await getApiBaseUrl();

      // 0. Encontrar ou criar a pasta do cliente no Google Drive do projeto
      const rootFolderId = project.folderId || project.folder_id || '';
      if (!rootFolderId) throw new Error("O ID da pasta do projeto não está configurado.");
      
      let clientFolderId = null;

      const listRes = await fetch(`${apiBase}/api/google/drive/list`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderId: rootFolderId })
      });

      if (listRes.ok) {
         const listData = await listRes.json();
         const canonicalize = (str) => {
             return String(str || '')
                 .normalize('NFD')
                 .replace(/[\u0300-\u036f]/g, '') // Fallback for \p{Diacritic} in older JS
                 .toUpperCase()
                 .replace(/[^A-Z0-9]/g, ' ')
                 .replace(/\s+/g, ' ')
                 .trim();
         };
         
         const cleanCode = String(process.noValue || '').split('.')[0].split(',')[0].trim();
         const targetPattern = canonicalize(`${cleanCode} ${process.clientName}`);
         
         const existingFolder = listData.find(f => {
             if (f.mimeType !== 'application/vnd.google-apps.folder') return false;
             const folderName = canonicalize(f.name);
             return folderName.includes(targetPattern);
         });
         
         if (existingFolder) {
             clientFolderId = existingFolder.id;
         }
      }

      if (!clientFolderId) {
         const cleanCode = String(process.noValue || '').split('.')[0].split(',')[0].trim();
         const newFolderName = cleanCode ? `${cleanCode}-${process.clientName}` : process.clientName;
         const createRes = await fetch(`${apiBase}/api/google/drive/create-folder`, {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ name: newFolderName, parentId: rootFolderId })
         });
         
         if (!createRes.ok) throw new Error("Falha ao criar sub-pasta do cliente no Google Drive.");
         const createData = await createRes.json();
         clientFolderId = createData.id;
      }

      const uploadedUrls = [];

      // 1. Fazer upload de todas as fotos para a pasta do CLIENTE
      for (let i = 0; i < photos.length; i++) {
        const photoUri = photos[i];
        const fileExt = photoUri.split('.').pop() || 'jpg';
        const fileName = `Entrega_${process.noValue}_${Date.now()}_${i+1}.${fileExt}`;
        
        // Usar uploadAsync diretamente. Caso FileSystemUploadType seja undefined, usar valor 1 (MULTIPART) fallback.
        const uploadTypeToUse = (typeof FileSystemUploadType !== 'undefined' && FileSystemUploadType.MULTIPART) ? FileSystemUploadType.MULTIPART : 1;
        
        const uploadRes = await uploadAsync(`${apiBase}/api/google/drive/upload`, photoUri, {
          httpMethod: 'POST',
          uploadType: uploadTypeToUse,
          fieldName: 'file',
          mimeType: `image/${fileExt}`,
          parameters: {
            parentId: clientFolderId,
            name: `FOTO_${process.processKey}_${new Date().getTime()}.jpg`
          }
        });

        if (uploadRes.status < 200 || uploadRes.status >= 300) {
          throw new Error(`Falha ao carregar a foto ${i+1}. Servidor retornou: ${uploadRes.status}`);
        }

        const driveData = JSON.parse(uploadRes.body);
        const fileId = driveData.id || driveData.fileId;
        if (!fileId) throw new Error(`Não foi recebido o ID do ficheiro ${i+1} do servidor.`);
        
        uploadedUrls.push(`https://drive.google.com/open?id=${fileId}`);
      }

      const allPhotosUrlString = uploadedUrls.join(' , ');

      // 2. Descobrir as colunas no Google Sheets usando os headers
      const headers = process.rows[0].headers;
      
      const cleanString = (str) => String(str || '').toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9]/g, "").trim();
      const findCol = (targets) => {
          const cleanedTargets = targets.map(cleanString);
          for (const target of cleanedTargets) {
              const idx = headers.findIndex(h => cleanString(h) === target);
              if (idx !== -1) return idx;
          }
          for (const target of cleanedTargets) {
              const idx = headers.findIndex(h => cleanString(h).includes(target));
              if (idx !== -1) return idx;
          }
          return -1;
      };

      let deliveredIdx = findCol(['DELIVERED', 'ENTREGUE', 'STATUS', 'CONFIRMATION']);
      let photoIdx = findCol(['FOTO', 'FOTOS', 'PHOTO', 'PHOTOS', 'FOTOGRAFIA', 'IMAGEM', 'COMPROVATIVO', 'ANEXO']);
      const agentIdx = findCol(['AGENT', 'AGENTE']);

      const structuralRequests = [];
      const sheetIdForStruct = process.sheetId; 
      
      // Se tivermos sheetId e encontrarmos AGENT, marcamos para apagar
      if (agentIdx !== -1 && sheetIdForStruct !== undefined && sheetIdForStruct !== null) {
          structuralRequests.push({
            deleteDimension: {
              range: {
                sheetId: sheetIdForStruct,
                dimension: 'COLUMNS',
                startIndex: agentIdx,
                endIndex: agentIdx + 1
              }
            }
          });
      }

      // Se não encontrarmos a foto, marcamos para criar uma coluna nova no final
      if (photoIdx === -1 && sheetIdForStruct !== undefined && sheetIdForStruct !== null) {
          structuralRequests.push({
            appendDimension: {
              sheetId: sheetIdForStruct,
              dimension: 'COLUMNS',
              length: 1
            }
          });
      }

      // Se houverem mudanças estruturais, executamos a API de estruturação primeiro
      if (structuralRequests.length > 0) {
          const structRes = await fetch(`${apiBase}/api/google/sheet/batch-requests`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              spreadsheetId: project.sheetId || project.sheet_id,
              requests: structuralRequests
            })
          });
          if (!structRes.ok) {
             const errData = await structRes.json();
             console.warn('Erro nas modificações estruturais, prosseguindo com fallback...', errData);
          }
      }

      // Recalcular índices se a coluna AGENT foi eliminada
      if (agentIdx !== -1 && sheetIdForStruct !== undefined && sheetIdForStruct !== null) {
          if (deliveredIdx > agentIdx) deliveredIdx--;
          if (photoIdx > agentIdx) photoIdx--;
      }

      // Determinar o novo índice da Foto
      if (photoIdx === -1) {
          // Se FOTO não existia, ela foi apensada no fim.
          // O índice será o tamanho original, menos 1 se o AGENT foi eliminado
          photoIdx = headers.length;
          if (agentIdx !== -1 && sheetIdForStruct !== undefined && sheetIdForStruct !== null) {
             photoIdx--;
          }
      }

      const dataToUpdate = [];

      // Como criamos a coluna FOTO, vamos colocar-lhe o cabeçalho
      if (structuralRequests.some(r => r.appendDimension)) {
          dataToUpdate.push({
              range: `${getColumnLetter(photoIdx)}1`,
              values: [['FOTO']]
          });
      }

      // Atualizar TODAS as linhas pertencentes a este processo
      process.rows.forEach(row => {
          const rowIndex = row.rowNumber;
          
          if (deliveredIdx !== -1) {
            dataToUpdate.push({
              range: `${getColumnLetter(deliveredIdx)}${rowIndex}`,
              values: [['ENTREGUE']]
            });
          }

          if (photoIdx !== -1) {
            dataToUpdate.push({
              range: `${getColumnLetter(photoIdx)}${rowIndex}`,
              values: [[allPhotosUrlString]]
            });
          }
      });

      if (dataToUpdate.length === 0) {
        throw new Error('As colunas DELIVERED ou FOTO não foram encontradas no ficheiro.');
      }

      const updateRes = await fetch(`${apiBase}/api/google/sheet/batch-update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          spreadsheetId: project.sheetId || project.sheet_id,
          data: dataToUpdate
        })
      });

      if (!updateRes.ok) {
         const errData = await updateRes.json();
         throw new Error(errData.error || 'Erro ao atualizar folha de cálculo');
      }

      Alert.alert('Sucesso', 'Todos os itens do processo foram confirmados e as fotos foram anexadas!', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);

    } catch (error) {
      Alert.alert('Erro', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Text style={styles.title}>Controlo Operacional</Text>
          <Text style={styles.subtitle}>{project.name}</Text>
        </View>

        <View style={styles.detailsCard}>
          <View style={styles.detailHeader}>
             <Text style={styles.detailNo}>Nº {process.noValue}</Text>
             <Text style={[styles.statusBadge, { backgroundColor: process.status === 'Entregue' ? '#D1FAE5' : (process.status === 'Parcial' ? '#DBEAFE' : '#FEF3C7'), color: process.status === 'Entregue' ? '#065F46' : (process.status === 'Parcial' ? '#1E40AF' : '#92400E') }]}>
               {process.status || 'Pendente'}
             </Text>
          </View>
          
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Cliente:</Text>
            <Text style={styles.detailValue}>{process.clientName}</Text>
          </View>
          
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Ordens:</Text>
            <Text style={styles.detailValueOrders}>{process.ordersArray || 'Sem Referências'}</Text>
          </View>

          <View style={styles.qtyContainer}>
             <View style={styles.qtyBoxBlue}>
                <Text style={styles.qtyBoxLabelBlue}>Total Original</Text>
                <Text style={styles.qtyBoxValueBlue}>{process.totalQty} <Text style={{fontSize: 10, color: '#6B7280'}}>Vol</Text></Text>
             </View>
             
             <View style={styles.qtyBoxYellow}>
                <Text style={styles.qtyBoxLabelYellow}>Descarregado</Text>
                <Text style={styles.qtyBoxValueYellow}>{process.totalDischarge} <Text style={{fontSize: 10, color: '#B45309'}}>Vol</Text></Text>
             </View>
             
             <View style={styles.qtyBoxGreen}>
                <Text style={styles.qtyBoxLabelGreen}>Entregue</Text>
                <Text style={styles.qtyBoxValueGreen}>{process.totalConfirmedQty} <Text style={{fontSize: 10, color: '#10B981'}}>Vol</Text></Text>
             </View>
          </View>
        </View>

        <View style={styles.photoSection}>
          <Text style={styles.photoSectionTitle}>Comprovativos ({photos.length})</Text>
          
          {photos.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photosScroll}>
              {photos.map((uri, index) => (
                <View key={index} style={styles.photoContainer}>
                  <Image source={{ uri }} style={styles.imagePreview} />
                  <TouchableOpacity style={styles.removePhotoBtn} onPress={() => removePhoto(index)} disabled={loading}>
                    <Text style={styles.removePhotoBtnText}>X</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          )}

          <TouchableOpacity style={styles.takePhotoBtn} onPress={takePhoto} disabled={loading}>
            <Text style={styles.iconCamera}>📸</Text>
            <Text style={styles.takePhotoText}>{photos.length > 0 ? 'Adicionar Mais Fotos' : 'Tirar Foto da Carga'}</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity 
          style={[styles.confirmBtn, (photos.length === 0 || loading) && styles.confirmBtnDisabled]} 
          onPress={confirmDelivery}
          disabled={photos.length === 0 || loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.confirmBtnText}>Confirmar Entrega Total</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  scroll: { padding: 20, flexGrow: 1 },
  header: { marginBottom: 20 },
  title: { fontSize: 24, fontWeight: '900', color: '#111827', textTransform: 'uppercase', tracking: 1 },
  subtitle: { fontSize: 14, fontWeight: 'bold', color: '#6B7280', marginTop: 4 },
  detailsCard: { backgroundColor: '#fff', padding: 20, borderRadius: 16, marginBottom: 20, borderWidth: 1, borderColor: '#E5E7EB', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  detailHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6', paddingBottom: 12 },
  detailNo: { fontSize: 18, fontWeight: '900', color: '#111827' },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, fontSize: 10, fontWeight: '900', textTransform: 'uppercase', overflow: 'hidden' },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12, alignItems: 'flex-start' },
  detailLabel: { fontSize: 12, color: '#6B7280', fontWeight: 'bold', textTransform: 'uppercase', width: 70 },
  detailValue: { fontSize: 16, color: '#111827', fontWeight: '900', flex: 1, textAlign: 'right' },
  detailValueOrders: { fontSize: 14, color: '#374151', fontWeight: 'bold', flex: 1, textAlign: 'right' },
  
  qtyContainer: { flexDirection: 'row', gap: 6, marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  
  qtyBoxBlue: { flex: 1, backgroundColor: '#EEF2FF', padding: 10, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: '#C7D2FE' },
  qtyBoxLabelBlue: { fontSize: 9, color: '#4338CA', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 2, textAlign: 'center' },
  qtyBoxValueBlue: { fontSize: 16, color: '#312E81', fontWeight: '900' },
  
  qtyBoxYellow: { flex: 1, backgroundColor: '#FEF3C7', padding: 10, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: '#FDE68A' },
  qtyBoxLabelYellow: { fontSize: 9, color: '#B45309', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 2, textAlign: 'center' },
  qtyBoxValueYellow: { fontSize: 16, color: '#78350F', fontWeight: '900' },

  qtyBoxGreen: { flex: 1, backgroundColor: '#ECFDF5', padding: 10, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: '#A7F3D0' },
  qtyBoxLabelGreen: { fontSize: 9, color: '#047857', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 2, textAlign: 'center' },
  qtyBoxValueGreen: { fontSize: 16, color: '#064E3B', fontWeight: '900' },

  photoSection: { marginBottom: 30 },
  photoSectionTitle: { fontSize: 14, fontWeight: 'bold', color: '#374151', marginBottom: 10, textTransform: 'uppercase' },
  photosScroll: { flexDirection: 'row', marginBottom: 15 },
  photoContainer: { position: 'relative', marginRight: 15 },
  imagePreview: { width: 120, height: 160, borderRadius: 12 },
  removePhotoBtn: { position: 'absolute', top: -10, right: -10, backgroundColor: '#EF4444', width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#fff', shadowColor: '#000', shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.2, shadowRadius: 3, elevation: 3 },
  removePhotoBtnText: { color: '#fff', fontWeight: '900', fontSize: 12 },
  takePhotoBtn: { backgroundColor: '#F3E8FF', borderWidth: 2, borderColor: '#D8B4FE', borderStyle: 'dashed', borderRadius: 16, height: 80, justifyContent: 'center', alignItems: 'center', flexDirection: 'row', gap: 10 },
  iconCamera: { fontSize: 24 },
  takePhotoText: { color: '#7E22CE', fontWeight: 'bold', fontSize: 16 },
  confirmBtn: { backgroundColor: '#10B981', padding: 18, borderRadius: 12, alignItems: 'center', shadowColor: '#10B981', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  confirmBtnDisabled: { backgroundColor: '#A7F3D0', shadowOpacity: 0 },
  confirmBtnText: { color: '#fff', fontWeight: '900', fontSize: 16, textTransform: 'uppercase', letterSpacing: 1 }
});
