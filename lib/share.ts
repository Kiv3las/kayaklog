import { Alert } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import i18n from './i18n';

/**
 * Rasterize the referenced view to a PNG and open the OS share sheet.
 * `ref` is the ShareCard's root View ref. No-ops gracefully if the user
 * cancels; surfaces a single alert on real failure.
 */
export async function shareViewAsImage(ref: React.RefObject<any>): Promise<void> {
  try {
    if (!ref.current) return;
    const uri = await captureRef(ref, {
      format: 'png',
      quality: 1,
      result: 'tmpfile',
    });

    if (!(await Sharing.isAvailableAsync())) {
      Alert.alert(i18n.t('share.error'));
      return;
    }
    await Sharing.shareAsync(uri, {
      mimeType: 'image/png',
      dialogTitle: 'KayakLog',
      UTI: 'public.png',
    });
  } catch (err: any) {
    // The share sheet throws nothing on user-cancel on iOS, so anything here
    // is a genuine capture/share failure.
    if (__DEV__) console.log('[share] error', err?.message);
    Alert.alert(i18n.t('share.error'));
  }
}
