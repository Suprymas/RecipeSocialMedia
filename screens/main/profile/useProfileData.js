import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { backend } from '../../../services/Backend';

// Friends and groups are not loaded from the backend yet; the profile shows these sample lists
// (same structure as FriendsScreen).
const SAMPLE_AVATAR = 'https://i.pinimg.com/736x/c4/0c/67/c40c6735f15972c25e6d8ef722d6f1f2.jpg';
const SAMPLE_FRIENDS = [
  { id: 1, name: 'lukas', avatar: SAMPLE_AVATAR },
  { id: 2, name: 'Justas', avatar: SAMPLE_AVATAR },
  { id: 3, name: 'Siebe', avatar: SAMPLE_AVATAR },
  { id: 4, name: 'Guda', avatar: SAMPLE_AVATAR },
];
const SAMPLE_GROUPS = [
  { id: 1, name: 'Room 3A', icon: 'restaurant' },
  { id: 2, name: 'Foodly', icon: 'restaurant-outline' },
];

async function fetchProfile(userId) {
  const { data, error } = await backend.from('profiles').select('*').eq('id', userId).single();
  if (error) throw error;
  return data;
}

// The user's rows of a table, newest first
async function fetchUserRows(table, userId) {
  const { data, error } = await backend
    .from(table)
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

// Rows shown in one profile tab; an empty list when loading fails
function useUserRows(table) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (userId) => {
    setLoading(true);
    try {
      setRows(await fetchUserRows(table, userId));
    } catch (error) {
      console.error(`Error loading ${table}:`, error);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [table]);

  return { rows, loading, load };
}

// Everything the profile screen shows, reloaded each time the screen comes into focus
export function useProfileData() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const recipes = useUserRows('recipes');
  const stories = useUserRows('stories');
  const loadRecipes = recipes.load;
  const loadStories = stories.load;

  const load = useCallback(async () => {
    try {
      setError(null);
      setLoading(true);
      const { data: { user: authUser }, error: authError } = await backend.auth.getUser();
      if (authError) throw authError;
      if (!authUser) return;

      setUser(await fetchProfile(authUser.id));
      loadRecipes(authUser.id);
      loadStories(authUser.id);
    } catch (loadError) {
      console.error('Error loading user data:', loadError);
      setError(loadError.message || 'Failed to load user data');
    } finally {
      setLoading(false);
    }
  }, [loadRecipes, loadStories]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return { user, loading, error, recipes, stories, friends: SAMPLE_FRIENDS, groups: SAMPLE_GROUPS };
}
