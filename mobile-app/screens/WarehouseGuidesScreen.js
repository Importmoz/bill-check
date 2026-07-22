import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator, Alert, SafeAreaView, TextInput } from 'react-native';

const API_BASE = 'http://10.140.113.44:3000';

export default function WarehouseGuidesScreen({ route, navigation }) {
  const { project } = route.params;
  const [processes, setProcesses] = useState([]);
  const [filteredProcesses, setFilteredProcesses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadSheetData();
  }, []);

  const loadSheetData = async () => {
    try {
      setLoading(true);
      
      const response = await fetch(`${API_BASE}/api/google/sheet/read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          spreadsheetId: project.sheetId || project.sheet_id,
          range: 'A1:AZ1000'
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Erro ao ler GSheet');

      const sheetId = project.sheetId || project.sheet_id;

      const rows = data.values || [];
      if (rows.length < 2) {
         setProcesses([]);
         return;
      }

      const headers = rows[0].map(h => String(h).toUpperCase().trim());
      
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

      let noIdx = headers.findIndex(c => {
          const h = String(c || '').toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
          return h === 'NO' || h === 'NA' || h === 'N' || h === 'NUMERO' || h.startsWith('NO.') || h.startsWith('NA.') || h.startsWith('N.');
      });
      if (noIdx === -1) noIdx = 0; // Default to first col

      const clientIdx = findCol(['NAME', 'NOME', 'CLIENTE', 'CLIENT']);
      const guideIdx = findCol(['HF2', 'REF', 'REFERENCIA', 'ORDER NUMBER', 'ORDER NUM', 'ORDER', 'CONV', 'CONTENTOR', 'GUIA']);
      const deliveredIdx = findCol(['DELIVERED', 'ENTREGUE', 'STATUS', 'CONFIRMATION', 'CONFIRMACAO', 'CONFIRM']);
      const photoIdx = findCol(['FOTO']);
      const packagesIdx = findCol(['PACKAGES', 'VOLUMES', 'QTIES', 'VOL', 'QTD', 'QUANT']);
      const dischargeIdx = findCol(['DISCHARGE', 'DESCARGA', 'DESCARREGADO']);
      const deliverIdx = findCol(['DELIVER', 'ENTREGA', 'ENTREGUE']);

      const groupedByProcess = new Map();

      let lastNo = '';
      let lastName = '';

      for (let i = 1; i < rows.length; i++) {
        const rowData = rows[i];
        if (!rowData || rowData.length === 0) continue;
        
        let noValue = noIdx !== -1 ? String(rowData[noIdx] || '').trim() : '';
        let clientName = clientIdx !== -1 ? String(rowData[clientIdx] || '').trim() : '';
        
        // Handle visually merged cells (empty downward)
        if (noValue) lastNo = noValue; else noValue = lastNo;
        if (clientName) lastName = clientName; else clientName = lastName;

        if (!noValue && !clientName) continue;
        if (clientName === '—' || String(rowData.join('')).toUpperCase().includes('TOTAL')) continue;

        const guideNumber = guideIdx !== -1 ? String(rowData[guideIdx] || '').trim() : '';
        const status = deliveredIdx !== -1 ? String(rowData[deliveredIdx] || '').trim() : '';
        const photo = photoIdx !== -1 ? String(rowData[photoIdx] || '').trim() : '';
        
        const qtyOriginal = packagesIdx !== -1 ? parseFloat(String(rowData[packagesIdx] || '0').replace(/[^0-9.-]+/g, '')) || 0 : 0;
        const qtyDischarge = dischargeIdx !== -1 ? parseFloat(String(rowData[dischargeIdx] || '0').replace(/[^0-9.-]+/g, '')) || 0 : 0;
        const qtyDeliver = deliverIdx !== -1 ? parseFloat(String(rowData[deliverIdx] || '0').replace(/[^0-9.-]+/g, '')) || 0 : 0;

        const processKey = `${noValue}_${clientName}`;

        if (!groupedByProcess.has(processKey)) {
          groupedByProcess.set(processKey, {
            processKey,
            noValue: noValue || 'S/N',
            clientName: clientName || 'Desconhecido',
            orders: new Set(),
            totalQty: 0,
            totalDischarge: 0,
            totalConfirmedQty: 0,
            photo: photo,
            status: 'Pendente',
            rows: [],
            sheetId: data.sheetId
          });
        }

        const processGroup = groupedByProcess.get(processKey);
        
        if (guideNumber && guideNumber !== '-') processGroup.orders.add(guideNumber);
        
        const isDeliveredStatus = status.toUpperCase().includes('ENTREGUE') || status.toUpperCase() === 'ENTREGUE';
        
        processGroup.rows.push({
          rowNumber: i + 1,
          status,
          headers,
          fullData: rowData,
          isDelivered: isDeliveredStatus
        });

        processGroup.totalQty += qtyOriginal;
        processGroup.totalDischarge += qtyDischarge;
        
        // Se já existir valor numérico de Deliver, usa-o. Se não, mas estiver marcado ENTREGUE no status, assumimos que confirmou tudo.
        if (qtyDeliver > 0) {
            processGroup.totalConfirmedQty += qtyDeliver;
        } else if (isDeliveredStatus) {
            processGroup.totalConfirmedQty += qtyOriginal; // Fallback para bater certo
        }

        if (!processGroup.photo && photo) processGroup.photo = photo;
      }

      // Convert Map to Array and consolidate status
      const processList = Array.from(groupedByProcess.values()).map(group => {
         group.ordersArray = Array.from(group.orders).join(', ');
         group.orders = Array.from(group.orders); // Corrigir serialização para navegação
         
         // Lógica de Estado: baseada primeiro nas quantidades se existirem, depois no status text
         if (group.totalConfirmedQty > 0 && group.totalConfirmedQty >= group.totalQty && group.totalQty > 0) {
             group.status = 'Entregue';
         } else if (group.rows.length > 0 && group.rows.every(r => r.isDelivered)) {
             group.status = 'Entregue';
         } else if (group.totalConfirmedQty > 0 || group.rows.some(r => r.isDelivered)) {
             group.status = 'Parcial';
         } else {
             group.status = 'Pendente';
         }

         return group;
      });

      // Sort by No
      processList.sort((a, b) => {
          const noA = parseInt(a.noValue, 10);
          const noB = parseInt(b.noValue, 10);
          if (!isNaN(noA) && !isNaN(noB)) return noA - noB;
          return a.noValue.localeCompare(b.noValue);
      });

      setProcesses(processList);
      setFilteredProcesses(processList);
    } catch (error) {
      Alert.alert('Erro', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (text) => {
    setSearch(text);
    if (!text) {
      setFilteredProcesses(processes);
      return;
    }
    const lower = text.toLowerCase();
    
    const filtered = processes.filter(p => {
       const clientMatch = p.clientName.toLowerCase().includes(lower);
       const noMatch = p.noValue.toLowerCase().includes(lower);
       const orderMatch = (p.ordersArray || '').toLowerCase().includes(lower);
       return clientMatch || noMatch || orderMatch;
    });

    setFilteredProcesses(filtered);
  };

  const renderItem = ({ item }) => {
    const isDelivered = item.status === 'Entregue';
    const isPartial = item.status === 'Parcial';
    
    return (
      <TouchableOpacity 
        style={[styles.card, isDelivered && styles.cardDelivered, isPartial && styles.cardPartial]}
        onPress={() => navigation.navigate('WarehouseDetail', { project, process: item })}
      >
        <View style={styles.cardHeader}>
          <View style={styles.processIdContainer}>
             <Text style={styles.processNo}>Nº {item.noValue}</Text>
             <Text style={styles.clientName}>{item.clientName}</Text>
          </View>
          {isDelivered ? (
            <View style={styles.badgeSuccess}><Text style={styles.badgeTextSuccess}>Entregue</Text></View>
          ) : isPartial ? (
            <View style={styles.badgePartial}><Text style={styles.badgeTextPartial}>Parcial</Text></View>
          ) : (
            <View style={styles.badgePending}><Text style={styles.badgeTextPending}>Pendente</Text></View>
          )}
        </View>

        <View style={styles.ordersRow}>
           <Text style={styles.ordersLabel}>Ordens:</Text>
           <Text style={styles.ordersText} numberOfLines={2}>{item.ordersArray || 'Sem Referências'}</Text>
        </View>

        <View style={styles.qtyRowContainer}>
           <View style={styles.qtyBoxBlue}>
               <Text style={styles.qtyBoxLabelBlue}>Original</Text>
               <Text style={styles.qtyBoxValueBlue}>{item.totalQty}</Text>
           </View>
           <View style={styles.qtyBoxYellow}>
               <Text style={styles.qtyBoxLabelYellow}>Descarg</Text>
               <Text style={styles.qtyBoxValueYellow}>{item.totalDischarge}</Text>
           </View>
           <View style={styles.qtyBoxGreen}>
               <Text style={styles.qtyBoxLabelGreen}>Entregue</Text>
               <Text style={styles.qtyBoxValueGreen}>{item.totalConfirmedQty}</Text>
           </View>
        </View>
        
        {item.photo ? (
          <Text style={styles.photoText}>📷 Foto Anexada</Text>
        ) : null}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{project.name}</Text>
        <TextInput 
          style={styles.searchInput} 
          placeholder="Pesquisar nº, cliente ou ordem..." 
          value={search}
          onChangeText={handleSearch}
        />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#10B981" style={{marginTop: 50}} />
      ) : (
        <FlatList
          data={filteredProcesses}
          keyExtractor={(item, index) => item.processKey + index}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 20 }}
          ListEmptyComponent={<Text style={styles.emptyText}>Nenhum processo encontrado.</Text>}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  header: { padding: 20, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  title: { fontSize: 22, fontWeight: 'bold', color: '#111827', marginBottom: 10 },
  searchInput: { backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 12, fontSize: 16 },
  card: { backgroundColor: '#fff', padding: 16, borderRadius: 12, marginBottom: 16, borderLeftWidth: 4, borderLeftColor: '#F59E0B', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  cardDelivered: { borderLeftColor: '#10B981', opacity: 0.9 },
  cardPartial: { borderLeftColor: '#3B82F6' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  processIdContainer: { flex: 1, marginRight: 10 },
  processNo: { fontSize: 12, fontWeight: 'bold', color: '#6B7280', textTransform: 'uppercase', marginBottom: 2 },
  clientName: { fontSize: 18, fontWeight: '900', color: '#111827' },
  ordersRow: { backgroundColor: '#F3F4F6', padding: 10, borderRadius: 6, marginBottom: 12 },
  ordersLabel: { fontSize: 10, fontWeight: 'bold', color: '#6B7280', textTransform: 'uppercase', marginBottom: 2 },
  ordersText: { fontSize: 12, color: '#374151', fontWeight: 'bold' },
  
  qtyRowContainer: { flexDirection: 'row', gap: 6, marginTop: 8 },
  qtyBoxBlue: { flex: 1, backgroundColor: '#EEF2FF', padding: 8, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: '#C7D2FE' },
  qtyBoxLabelBlue: { fontSize: 9, color: '#4338CA', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 2 },
  qtyBoxValueBlue: { fontSize: 14, color: '#312E81', fontWeight: '900' },
  
  qtyBoxYellow: { flex: 1, backgroundColor: '#FEF3C7', padding: 8, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: '#FDE68A' },
  qtyBoxLabelYellow: { fontSize: 9, color: '#B45309', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 2 },
  qtyBoxValueYellow: { fontSize: 14, color: '#78350F', fontWeight: '900' },

  qtyBoxGreen: { flex: 1, backgroundColor: '#ECFDF5', padding: 8, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: '#A7F3D0' },
  qtyBoxLabelGreen: { fontSize: 9, color: '#047857', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 2 },
  qtyBoxValueGreen: { fontSize: 14, color: '#064E3B', fontWeight: '900' },

  photoText: { fontSize: 12, color: '#6B7280', marginTop: 12, fontStyle: 'italic' },
  badgeSuccess: { backgroundColor: '#D1FAE5', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  badgeTextSuccess: { color: '#065F46', fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase' },
  badgePending: { backgroundColor: '#FEF3C7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  badgeTextPending: { color: '#92400E', fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase' },
  badgePartial: { backgroundColor: '#DBEAFE', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  badgeTextPartial: { color: '#1E40AF', fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase' },
  emptyText: { textAlign: 'center', color: '#6B7280', marginTop: 50 }
});
