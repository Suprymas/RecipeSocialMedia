import { Dimensions, Image, StyleSheet, TouchableOpacity, View } from 'react-native';
import { ThemedText } from '../../../components/ThemedText';
import { formatCardDate } from './profileFormat';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48) / 2; // 2 columns with padding

function CardImage({ uri }) {
  if (!uri) {
    return (
      <View style={styles.imagePlaceholder}>
        <ThemedText style={styles.placeholderText}>No Image</ThemedText>
      </View>
    );
  }
  return <Image source={{ uri }} style={styles.image} resizeMode="cover" />;
}

function AuthorRow({ author }) {
  const name = author?.username;
  return (
    <View style={styles.authorRow}>
      <View style={styles.authorAvatar}>
        <ThemedText style={styles.avatarText}>{name?.charAt(0).toUpperCase() || 'U'}</ThemedText>
      </View>
      <ThemedText style={styles.authorName} lightColor="#000" darkColor="#000">
        {name || 'Unknown'}
      </ThemedText>
    </View>
  );
}

export function RecipeCard({ recipe, onPress }) {
  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.7} onPress={onPress}>
      <CardImage uri={recipe.main_image_url} />
      <View style={styles.cardContent}>
        <View style={styles.recipeHeader}>
          <ThemedText style={styles.recipeTitle} numberOfLines={1} lightColor="#000" darkColor="#000">
            {recipe.title}
          </ThemedText>
          <ThemedText style={styles.recipeDate} lightColor="#666" darkColor="#666">
            {formatCardDate(recipe.created_at)}
          </ThemedText>
        </View>
        <View style={styles.divider} />
        <AuthorRow author={recipe.author} />
      </View>
    </TouchableOpacity>
  );
}

export function StoryCard({ story }) {
  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.7}>
      <CardImage uri={story.image} />
      <View style={styles.cardContent}>
        <ThemedText style={styles.storyContent} numberOfLines={2} lightColor="#000" darkColor="#000">
          {story.title || ''}
        </ThemedText>
        <View style={styles.divider} />
        <AuthorRow author={story.author} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  image: {
    width: '100%',
    height: CARD_WIDTH * 0.75,
    backgroundColor: '#f0f0f0',
  },
  imagePlaceholder: {
    width: '100%',
    height: CARD_WIDTH * 0.75,
    backgroundColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: 12,
    color: '#999',
  },
  cardContent: {
    padding: 12,
  },
  recipeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  recipeTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    flex: 1,
  },
  recipeDate: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
  },
  storyContent: {
    fontSize: 16,
    color: '#000',
    marginBottom: 8,
  },
  divider: {
    height: 1,
    backgroundColor: '#E0E0E0',
    marginBottom: 8,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  authorAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  authorName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#000',
  },
});
