// Behaviour of saving the profile (handleSave in ProfileSettingsScreen).
// The backend, image picker and icons are replaced; everything else is the real screen.
//
// Each test notes the part of handleSave it covers. Together they cover every line and
// branch of handleSave.
import React from 'react';
import { Alert, Image } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as ImagePicker from 'expo-image-picker';
import ProfileSettingsScreen from '../screens/settings/ProfileSettingsScreen';
import { backend, uploadImage } from '../services/Backend';
import { fakeFrom, pending } from './helpers/fakeBackend';

jest.mock('../services/Backend', () => ({
  backend: { auth: { getUser: jest.fn() }, from: jest.fn() },
  uploadImage: jest.fn(),
}));
jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: jest.fn(),
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
  MediaTypeOptions: { Images: 'Images' },
}));
jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return { Ionicons: ({ name }) => React.createElement(Text, null, `icon:${name}`) };
});
jest.mock('@react-navigation/native', () => ({ useNavigation: jest.fn() }));

const AUTH_USER = { id: 'user-1', email: 'anna@test.app' };
const PROFILE = { id: 'user-1', username: 'anna', bio: 'Pasta lover', avatar_url: null };
const EXISTS = { data: { id: 'user-1' }, error: null };
const MISSING = { data: null, error: { code: 'PGRST116', message: 'JSON object requested, 0 rows returned' } };

// Renders the screen. `check` answers "does the profile exist", `write` answers the insert/update.
async function setup({ profile = PROFILE, check = EXISTS, write = { error: null } } = {}) {
  const fake = fakeFrom((query) => {
    if (query.action === 'select' && query.columns === '*') return { data: profile, error: null };
    if (query.action === 'select') return check;
    return typeof write === 'function' ? write(query) : write;
  });
  backend.from.mockImplementation(fake.from);
  const navigation = { goBack: jest.fn() };
  render(<ProfileSettingsScreen navigation={navigation} />);
  await screen.findByText('Save Changes');
  const writes = () => fake.queries.filter((q) => q.action !== 'select');
  return { navigation, writes };
}

const lastAlert = () => Alert.alert.mock.calls.at(-1);
const save = () => fireEvent.press(screen.getByText('Save Changes'));
const waitForAlert = (...args) => waitFor(() => expect(Alert.alert).toHaveBeenCalledWith(...args));

async function pickFromLibrary(uri) {
  ImagePicker.launchImageLibraryAsync.mockResolvedValue({ canceled: false, assets: [{ uri }] });
  fireEvent.press(screen.getByText('Change Avatar'));
  const [, , buttons] = lastAlert();
  buttons.find((b) => b.text === 'Choose from Library').onPress();
  await waitFor(() => expect(screen.UNSAFE_getByType(Image).props.source.uri).toBe(uri));
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  backend.auth.getUser.mockResolvedValue({ data: { user: AUTH_USER } });
  ImagePicker.requestCameraPermissionsAsync.mockResolvedValue({ status: 'granted' });
  ImagePicker.requestMediaLibraryPermissionsAsync.mockResolvedValue({ status: 'granted' });
});

describe('handleSave', () => {
  // if (!username.trim()) -> Alert 'Username is required' and return before anything else
  it('requires a username', async () => {
    const { writes } = await setup();
    fireEvent.changeText(screen.getByPlaceholderText('Enter username'), '   ');
    save();
    expect(Alert.alert).toHaveBeenCalledWith('Error', 'Username is required');
    expect(backend.auth.getUser).toHaveBeenCalledTimes(1); // only the initial load
    expect(writes()).toEqual([]);
  });

  // if (!authUser) -> Alert 'You must be logged in' and return; finally resets the saving state
  it('requires a signed-in user', async () => {
    const { writes } = await setup();
    backend.auth.getUser.mockResolvedValueOnce({ data: { user: null } });
    save();
    await waitForAlert('Error', 'You must be logged in');
    expect(writes()).toEqual([]);
    expect(screen.getByText('Save Changes')).toBeTruthy();
  });

  // setSaving(true) at the start of the try block
  it('shows "Saving..." while the save is running', async () => {
    await setup({ write: pending() });
    save();
    expect(await screen.findByText('Saving...')).toBeTruthy();
  });

  // avatarUri is null -> no upload; profile exists -> update with trimmed values;
  // success Alert and its OK button -> navigation.goBack(); finally resets the saving state
  it('updates the existing profile with trimmed values and goes back on OK', async () => {
    const { navigation, writes } = await setup();
    fireEvent.changeText(screen.getByPlaceholderText('Enter username'), '  chef  ');
    fireEvent.changeText(screen.getByPlaceholderText('Tell us about yourself'), '  Loves bread  ');
    save();
    await waitForAlert('Success', 'Profile updated successfully!', expect.any(Array));

    const [update] = writes();
    expect(update.table).toBe('profiles');
    expect(update.action).toBe('update');
    expect(update.payload).toEqual({ username: 'chef', bio: 'Loves bread', avatar_url: null, updated_at: expect.any(String) });
    expect(update.filters).toEqual([{ column: 'id', op: 'eq', value: 'user-1' }]);

    lastAlert()[2][0].onPress();
    expect(navigation.goBack).toHaveBeenCalled();
    expect(screen.getByText('Save Changes')).toBeTruthy();
  });

  // avatarUri !== user?.avatar_url is false -> no upload; avatarUrl = user?.avatar_url
  it('keeps the current avatar without uploading it again', async () => {
    const { writes } = await setup({ profile: { ...PROFILE, avatar_url: 'https://cdn.test/a.jpg' } });
    save();
    await waitForAlert('Success', 'Profile updated successfully!', expect.any(Array));
    expect(uploadImage).not.toHaveBeenCalled();
    expect(writes()[0].payload.avatar_url).toBe('https://cdn.test/a.jpg');
  });

  // all three upload conditions true -> uploadImage succeeds -> avatarUrl = uploaded URL
  it('uploads a newly picked local image and saves its URL', async () => {
    const { writes } = await setup();
    uploadImage.mockResolvedValue('https://cdn.test/new.jpg');
    await pickFromLibrary('file:///photos/new.jpg');
    save();
    await waitForAlert('Success', 'Profile updated successfully!', expect.any(Array));
    expect(uploadImage).toHaveBeenCalledWith('file:///photos/new.jpg', 'avatars', 'user-1');
    expect(writes()[0].payload.avatar_url).toBe('https://cdn.test/new.jpg');
  });

  // setUploadingAvatar(true) before the upload
  it('shows "Uploading..." while the image uploads', async () => {
    await setup();
    uploadImage.mockReturnValue(pending());
    await pickFromLibrary('file:///photos/new.jpg');
    save();
    expect(await screen.findByText('Uploading...')).toBeTruthy();
  });

  // catch (uploadError) -> 'Warning' Alert; avatarUrl = user?.avatar_url || null (both sides of ||)
  it.each([
    ['https://cdn.test/old.jpg'],
    [null],
  ])('warns, keeps the saved avatar (%s) and saves the other changes when the upload fails', async (saved) => {
    const { writes } = await setup({ profile: { ...PROFILE, avatar_url: saved } });
    uploadImage.mockRejectedValue(new Error('offline'));
    await pickFromLibrary('file:///photos/new.jpg');
    save();
    await waitForAlert('Success', 'Profile updated successfully!', expect.any(Array));
    expect(Alert.alert).toHaveBeenCalledWith('Warning', 'Failed to upload avatar image, but other changes will be saved.', [{ text: 'OK' }]);
    expect(writes()[0].payload.avatar_url).toBe(saved);
  });

  // !avatarUri.startsWith('http') is false -> no upload, and the picked URL is not saved
  it('does not upload a picked image that is already a web URL (and keeps the saved avatar)', async () => {
    const { writes } = await setup();
    await pickFromLibrary('https://example.test/b.jpg');
    save();
    await waitForAlert('Success', 'Profile updated successfully!', expect.any(Array));
    expect(uploadImage).not.toHaveBeenCalled();
    expect(writes()[0].payload.avatar_url).toBeNull();
  });

  // checkError.code === 'PGRST116' -> insert; no insertError -> success Alert, OK -> goBack(); return
  it('creates the profile when it does not exist yet and goes back on OK', async () => {
    const { navigation, writes } = await setup({ check: MISSING });
    save();
    await waitForAlert('Success', 'Profile created successfully!', expect.any(Array));
    const [insert] = writes();
    expect(insert.action).toBe('insert');
    expect(insert.payload).toEqual({
      id: 'user-1', username: 'anna', bio: 'Pasta lover', avatar_url: null,
      created_at: expect.any(String), updated_at: expect.any(String),
    });
    expect(writes()).toHaveLength(1);
    lastAlert()[2][0].onPress();
    expect(navigation.goBack).toHaveBeenCalled();
  });

  // user is null (profile not loaded) -> user?.avatar_url is undefined -> avatar_url null; insert path
  it('creates a profile for a user whose profile could not be loaded', async () => {
    const { writes } = await setup({ profile: null, check: MISSING });
    expect(screen.getByPlaceholderText('Enter username').props.value).toBe('');
    fireEvent.changeText(screen.getByPlaceholderText('Enter username'), 'newbie');
    save();
    await waitForAlert('Success', 'Profile created successfully!', expect.any(Array));
    expect(writes()[0].payload).toMatchObject({ username: 'newbie', bio: '', avatar_url: null });
  });

  // checkError set but code !== 'PGRST116' -> falls through to the update
  it('updates when the existence check fails for another reason', async () => {
    const { writes } = await setup({ check: { data: null, error: { code: '500', message: 'boom' } } });
    save();
    await waitForAlert('Success', 'Profile updated successfully!', expect.any(Array));
    expect(writes()[0].action).toBe('update');
  });

  // if (insertError) throw -> catch: error.message is set
  it('reports a failed insert', async () => {
    await setup({ check: MISSING, write: { error: { message: 'insert failed' } } });
    save();
    await waitForAlert('Error', 'Failed to update profile: insert failed');
  });

  // if (updateError) throw -> catch: error.message / else if (error.code) / neither; finally resets the button
  it.each([
    [{ message: 'permission denied' }, 'Failed to update profile: permission denied'],
    [{ code: '42501' }, 'Failed to update profile (42501)'],
    [{}, 'Failed to update profile'],
  ])('reports a failed update %j', async (error, message) => {
    await setup({ write: { error } });
    save();
    await waitForAlert('Error', message);
    expect(screen.getByText('Save Changes')).toBeTruthy();
  });
});
