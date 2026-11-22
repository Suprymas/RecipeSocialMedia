// Behaviour of the profile screen (ProfileScreen): loading, errors, profile details,
// recipe and story tabs, and the friends / groups list.
// The backend, navigation and icons are replaced; everything else is the real screen.
//
// Each test notes the part of ProfileScreen it covers.
// Not covered, because the screen can never reach it:
//   - handleLogout: the function is never used by the screen.
//   - the catch in loadFriendsAndGroupsCount and the "No friends yet" state: friends and
//     groups are hard-coded lists, so loading them cannot fail and the friends list is never empty.
import React from 'react';
import { Image, Modal } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { useNavigation } from '@react-navigation/native';
import ProfileScreen from '../screens/main/ProfileScreen';
import { backend } from '../services/Backend';
import { fakeFrom, pending } from './helpers/fakeBackend';

jest.mock('../services/Backend', () => ({
  backend: { auth: { getUser: jest.fn(), signOut: jest.fn() }, from: jest.fn() },
}));
jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return { Ionicons: ({ name }) => React.createElement(Text, null, `icon:${name}`) };
});
jest.mock('@react-navigation/native', () => {
  const React = require('react');
  const navigation = { navigate: jest.fn() };
  return {
    useNavigation: () => navigation,
    // Runs the focus effect once on mount, and its cleanup on unmount
    useFocusEffect: (effect) => React.useEffect(effect, [effect]),
  };
});

const navigation = useNavigation();
const AUTH_USER = { id: 'abcdef12-3456-7890-abcd-ef1234567890', email: 'anna@test.app' };
const PROFILE = {
  id: AUTH_USER.id, username: 'chef_anna', bio: 'Pasta lover', avatar_url: null,
  created_at: '2025-03-05T10:00:00Z',
};
const RECIPES = [
  { id: 'r1', title: 'Soup', created_at: '2025-04-01T12:00:00Z', main_image_url: 'https://img.test/soup.jpg', author: { username: 'anna' } },
  { id: 'r2', title: 'Bread', created_at: '2025-02-10T12:00:00Z', main_image_url: null },
];
const STORIES = [
  { id: 's1', title: 'Morning bake', image: 'https://img.test/s1.jpg', author: { username: 'ben' } },
  { id: 's2', title: null, image: null },
];
const ok = (data) => ({ data, error: null });

// Renders the screen; each option is the answer for that part of the load (value or promise)
function setup({ auth = { data: { user: AUTH_USER }, error: null }, profile = ok(PROFILE), recipes = ok(RECIPES), stories = ok(STORIES) } = {}) {
  backend.auth.getUser.mockReturnValue(auth instanceof Promise ? auth : Promise.resolve(auth));
  const fake = fakeFrom((query) => ({ profiles: profile, recipes, stories })[query.table]);
  backend.from.mockImplementation(fake.from);
  render(<ProfileScreen />);
  return fake;
}

const imageUris = () => screen.UNSAFE_queryAllByType(Image).map((i) => i.props.source.uri);

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

// loadUserData and the `loading ? ... : user ? ... : error` part of the render
describe('ProfileScreen: loading and errors', () => {
  // loading is true -> "Loading..." in the content area; header always rendered
  it('shows the header and "Loading..." while the user loads', () => {
    setup({ auth: pending() });
    expect(screen.getByText('Your profile')).toBeTruthy();
    expect(screen.getByText('Loading...')).toBeTruthy();
  });

  // if (authError) throw -> catch: setError(error.message) -> error view shows the message
  it('shows the sign-in error', async () => {
    setup({ auth: { data: { user: null }, error: { message: 'Auth session missing!' } } });
    expect(await screen.findByText('Auth session missing!')).toBeTruthy();
  });

  // if (authUser) is false -> nothing is loaded; render `error || 'Failed to load user data'`
  it('shows the default message when nobody is signed in', async () => {
    setup({ auth: { data: { user: null }, error: null } });
    expect(await screen.findByText('Failed to load user data')).toBeTruthy();
    expect(backend.from).not.toHaveBeenCalled();
  });

  // if (profileError) throw -> catch with error.message
  it('shows the profile loading error', async () => {
    setup({ profile: { data: null, error: { message: 'Profile not found' } } });
    expect(await screen.findByText('Profile not found')).toBeTruthy();
  });

  // catch: error.message || 'Failed to load user data'
  it('shows the default message for an error without text', async () => {
    setup({ profile: { data: null, error: {} } });
    expect(await screen.findByText('Failed to load user data')).toBeTruthy();
  });
});

// The profile information block: getProfileId, getJoinDate, bio, avatar, counts, menu button
describe('ProfileScreen: profile details', () => {
  // getProfileId with user.id, getJoinDate with user.created_at, user.bio, no avatar_url -> person icon,
  // loadFriendsAndGroupsCount -> friendsCount / groupsCount
  it('shows name, profile id, bio, join date and counts', async () => {
    setup();
    expect(await screen.findByText('chef_anna')).toBeTruthy();
    expect(screen.getByText('Profile ID: 1KGZabcdef12')).toBeTruthy();
    expect(screen.getByText('Pasta lover')).toBeTruthy();
    expect(screen.getByText('Joined: 05.03.25')).toBeTruthy();
    expect(screen.getByText('Friends: 4')).toBeTruthy();
    expect(screen.getByText('Groups: 2')).toBeTruthy();
    expect(screen.getByText('icon:person')).toBeTruthy();
  });

  // getProfileId: no user.id -> '1KGZ123'; getJoinDate: no created_at -> '14.11.25'; user.bio || default text
  it('uses fallbacks when bio, join date and id are missing', async () => {
    setup({ profile: ok({ username: 'plain' }) });
    expect(await screen.findByText('plain')).toBeTruthy();
    expect(screen.getByText('Profile ID: 1KGZ123')).toBeTruthy();
    expect(screen.getByText('I love food because you can eat it!')).toBeTruthy();
    expect(screen.getByText('Joined: 14.11.25')).toBeTruthy();
  });

  // user.avatar_url ? <Image> : <Ionicons name="person">
  it('shows the avatar picture when there is one', async () => {
    setup({ profile: ok({ ...PROFILE, avatar_url: 'https://img.test/me.jpg' }) });
    await screen.findByText('chef_anna');
    expect(screen.queryByText('icon:person')).toBeNull();
    expect(imageUris()).toContain('https://img.test/me.jpg');
  });

  // loadUserData success path: profile query, then loadRecipes and loadStories with the user id
  it("loads the signed-in user's profile, recipes and stories, newest first", async () => {
    const fake = setup();
    await screen.findByText('Soup');
    const byTable = Object.fromEntries(fake.queries.map((q) => [q.table, q]));
    expect(byTable.profiles).toMatchObject({ columns: '*', single: true, filters: [{ column: 'id', op: 'eq', value: AUTH_USER.id }] });
    for (const table of ['recipes', 'stories']) {
      expect(byTable[table].filters).toEqual([{ column: 'user_id', op: 'eq', value: AUTH_USER.id }]);
      expect(byTable[table].orders).toEqual([{ column: 'created_at', ascending: false }]);
    }
  });

  // menu button onPress -> navigation.navigate('Settings')
  it('opens the settings from the menu button', async () => {
    setup();
    await screen.findByText('chef_anna');
    fireEvent.press(screen.getByText('icon:menu-outline'));
    expect(navigation.navigate).toHaveBeenCalledWith('Settings');
  });
});

// loadRecipes and the `activeTab === 'recipes'` part of the content grid
describe('ProfileScreen: recipes tab', () => {
  // recipes.map: main_image_url ? <Image> : 'No Image'; author?.username || 'Unknown' / 'U';
  // date formatting; card onPress -> navigate('RecipeDetail', { id })
  it('shows recipe cards with date, picture and author, and opens a recipe', async () => {
    setup();
    expect(await screen.findByText('Soup')).toBeTruthy();
    expect(screen.getByText('01.04.2025')).toBeTruthy();
    expect(screen.getByText('anna')).toBeTruthy();
    expect(screen.getByText('A')).toBeTruthy();
    expect(imageUris()).toContain('https://img.test/soup.jpg');

    expect(screen.getByText('Bread')).toBeTruthy();
    expect(screen.getByText('10.02.2025')).toBeTruthy();
    expect(screen.getByText('No Image')).toBeTruthy();
    expect(screen.getByText('Unknown')).toBeTruthy();
    expect(screen.getByText('U')).toBeTruthy();

    fireEvent.press(screen.getByText('Soup'));
    expect(navigation.navigate).toHaveBeenCalledWith('RecipeDetail', { id: 'r1' });
  });

  // recipesLoading ? 'Loading recipes...'
  it('shows "Loading recipes..." while recipes load', async () => {
    setup({ recipes: pending() });
    await screen.findByText('chef_anna');
    expect(screen.getByText('Loading recipes...')).toBeTruthy();
  });

  // setRecipes(data || []) with data null -> recipes.length === 0 -> empty message
  it('shows the empty message when there are no recipes', async () => {
    setup({ recipes: ok(null) });
    expect(await screen.findByText('No recipes yet. Create your first recipe!')).toBeTruthy();
  });

  // loadRecipes: if (error) throw -> catch: setRecipes([])
  it('shows the empty message when loading recipes fails', async () => {
    setup({ recipes: { data: null, error: { message: 'offline' } } });
    expect(await screen.findByText('No recipes yet. Create your first recipe!')).toBeTruthy();
  });
});

// loadStories, the tab buttons and the stories part of the content grid
describe('ProfileScreen: stories tab', () => {
  // tab onPress -> setActiveTab('stories') and back to 'recipes' (both sides of every
  // activeTab === ... condition); stories.map: image ? <Image> : 'No Image', title || '',
  // author?.username || 'Unknown' / 'U'
  it('switches to stories and back', async () => {
    setup();
    await screen.findByText('Soup');
    fireEvent.press(screen.getByText('Your Stories'));
    expect(screen.getByText('Morning bake')).toBeTruthy();
    expect(screen.getByText('ben')).toBeTruthy();
    expect(screen.getByText('B')).toBeTruthy();
    expect(imageUris()).toContain('https://img.test/s1.jpg');
    expect(screen.getByText('No Image')).toBeTruthy();
    expect(screen.getByText('Unknown')).toBeTruthy();
    expect(screen.queryByText('Soup')).toBeNull();

    fireEvent.press(screen.getByText('Your Recipe'));
    expect(screen.getByText('Soup')).toBeTruthy();
    expect(screen.queryByText('Morning bake')).toBeNull();
  });

  // storiesLoading ? 'Loading stories...'
  it('shows "Loading stories..." while stories load', async () => {
    setup({ stories: pending() });
    await screen.findByText('Soup');
    fireEvent.press(screen.getByText('Your Stories'));
    expect(screen.getByText('Loading stories...')).toBeTruthy();
  });

  // setStories(data || []) with data null, and loadStories catch: setStories([]) -> empty message
  it.each([
    ['there are no stories', ok(null)],
    ['loading stories fails', { data: null, error: { message: 'offline' } }],
  ])('shows the empty message when %s', async (_, stories) => {
    setup({ stories });
    await screen.findByText('Soup');
    fireEvent.press(screen.getByText('Your Stories'));
    expect(await screen.findByText('No stories yet. Share your first story!')).toBeTruthy();
  });
});

// handleShowList, handleCloseModal and the <Modal> with `listType === 'friends' ? ... : ...`
describe('ProfileScreen: friends and groups list', () => {
  // handleShowList('friends'); friends.map; friend onPress -> handleCloseModal + navigate to a direct chat
  it('lists friends and opens a direct chat with one', async () => {
    setup();
    fireEvent.press(await screen.findByText('Friends: 4'));
    expect(screen.getByText('Friends')).toBeTruthy();
    for (const name of ['lukas', 'Justas', 'Siebe', 'Guda']) expect(screen.getByText(name)).toBeTruthy();

    fireEvent.press(screen.getByText('lukas'));
    expect(navigation.navigate).toHaveBeenCalledWith('GroupChat', {
      friendId: 1, friendName: 'lukas', friendAvatar: expect.stringMatching(/^https:/), isDirectChat: true,
    });
    expect(screen.queryByText('Friends')).toBeNull();
  });

  // handleShowList('groups'); groups.map; group onPress -> handleCloseModal + navigate to the group chat
  it('lists groups and opens a group chat', async () => {
    setup();
    fireEvent.press(await screen.findByText('Groups: 2'));
    expect(screen.getByText('Groups')).toBeTruthy();
    expect(screen.getByText('Room 3A')).toBeTruthy();
    expect(screen.getByText('icon:restaurant')).toBeTruthy();

    fireEvent.press(screen.getByText('Foodly'));
    expect(navigation.navigate).toHaveBeenCalledWith('GroupChat', { groupId: 2, groupName: 'Foodly', groupIcon: 'restaurant-outline' });
    expect(screen.queryByText('Groups')).toBeNull();
  });

  // close button onPress and Modal onRequestClose -> handleCloseModal
  it('closes the list with the close button and with the back gesture', async () => {
    setup();
    fireEvent.press(await screen.findByText('Friends: 4'));
    fireEvent.press(screen.getByText('icon:close'));
    expect(screen.queryByText('Friends')).toBeNull();

    fireEvent.press(screen.getByText('Groups: 2'));
    fireEvent(screen.UNSAFE_getByType(Modal), 'requestClose');
    expect(screen.queryByText('Groups')).toBeNull();
    expect(navigation.navigate).not.toHaveBeenCalled();
  });

  // the cleanup function returned from the useFocusEffect callback
  it('cleans up when the screen goes away', async () => {
    setup();
    await screen.findByText('chef_anna');
    expect(() => screen.unmount()).not.toThrow();
  });
});
