import { Alert } from 'react-native';
import { backend, uploadImage } from '../../services/Backend';

// A picked image is uploaded only when it is a new local file:
// not the avatar that is already saved, and not a web URL
export const needsUpload = (pickedUri, savedUrl) =>
  Boolean(pickedUri) && pickedUri !== savedUrl && !pickedUri.startsWith('http');

// Avatar URL to save: the newly picked image after uploading it, otherwise the saved avatar.
// A failed upload only shows a warning, so the rest of the profile can still be saved.
// onUploading(true / false) reports when the upload starts and ends.
export async function resolveAvatarUrl({ pickedUri, savedUrl, userId, onUploading }) {
  const keptUrl = savedUrl || null;
  if (!needsUpload(pickedUri, savedUrl)) return keptUrl;

  onUploading(true);
  try {
    return await uploadImage(pickedUri, 'avatars', userId);
  } catch (error) {
    console.error('Error uploading avatar:', error);
    Alert.alert('Warning', 'Failed to upload avatar image, but other changes will be saved.', [{ text: 'OK' }]);
    return keptUrl;
  } finally {
    onUploading(false);
  }
}

// Creates the profile when it does not exist yet, otherwise updates it.
// Returns true when a new profile was created.
export async function saveProfile(userId, fields) {
  const now = new Date().toISOString();
  const { error: checkError } = await backend.from('profiles').select('id').eq('id', userId).single();
  const isNew = checkError?.code === 'PGRST116';

  const { error } = isNew
    ? await backend.from('profiles').insert({ id: userId, ...fields, created_at: now, updated_at: now })
    : await backend.from('profiles').update({ ...fields, updated_at: now }).eq('id', userId);
  if (error) throw error;
  return isNew;
}

// Message shown when saving fails: with the error's message, otherwise with its code
export function saveErrorMessage(error) {
  if (error.message) return `Failed to update profile: ${error.message}`;
  if (error.code) return `Failed to update profile (${error.code})`;
  return 'Failed to update profile';
}
