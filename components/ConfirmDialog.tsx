import React, { useEffect, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Animated, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../lib/themeContext';
import type { Colors } from '../constants/theme';

interface Props {
  visible: boolean;
  title: string;
  message: string;
  detail?: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmLabel?: string;
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    },
    card: {
      backgroundColor: c.cardBg,
      borderRadius: 16,
      padding: 24,
      width: '100%',
      alignItems: 'center',
    },
    iconWrap: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: c.danger,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 16,
    },
    title: {
      fontSize: 18,
      fontWeight: '700',
      color: c.textPrimary,
      marginBottom: 8,
      textAlign: 'center',
    },
    message: {
      fontSize: 15,
      color: c.textSecondary,
      textAlign: 'center',
      marginBottom: 4,
    },
    detail: {
      fontSize: 13,
      color: c.textTertiary,
      textAlign: 'center',
      marginBottom: 4,
    },
    warning: {
      fontSize: 12,
      color: c.danger,
      textAlign: 'center',
      marginBottom: 20,
      fontStyle: 'italic',
    },
    btnRow: { flexDirection: 'row', gap: 12, width: '100%' },
    btn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
    cancelBtn: { backgroundColor: c.primary },
    dangerBtn: { backgroundColor: c.danger },
    cancelText: { color: '#fff', fontWeight: '700', fontSize: 15 },
    dangerText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  });
}

export default function ConfirmDialog({ visible, title, message, detail, onConfirm, onCancel, confirmLabel }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const resolvedConfirmLabel = confirmLabel ?? t('confirm.delete');
  const scale = useRef(new Animated.Value(0.8)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      scale.setValue(0.8);
      opacity.setValue(0);
    }
  }, [visible]);

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onCancel}>
      <Pressable style={styles.overlay} onPress={onCancel}>
        <Animated.View style={[styles.card, { transform: [{ scale }], opacity }]}>
          <View style={styles.iconWrap}>
            <Ionicons name="trash" size={28} color="#fff" />
          </View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          {detail && <Text style={styles.detail}>{detail}</Text>}
          <Text style={styles.warning}>{t('confirm.cannotUndo')}</Text>
          <View style={styles.btnRow}>
            <TouchableOpacity style={[styles.btn, styles.cancelBtn]} onPress={onCancel}>
              <Text style={styles.cancelText}>{t('confirm.cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, styles.dangerBtn]} onPress={onConfirm}>
              <Text style={styles.dangerText}>{resolvedConfirmLabel}</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}
