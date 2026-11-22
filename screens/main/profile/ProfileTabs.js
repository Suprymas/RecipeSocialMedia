import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { ThemedText } from '../../../components/ThemedText';
import { RecipeCard, StoryCard } from './ProfileCards';
import { StatusMessage } from './StatusMessage';

const TABS = [
  { key: 'recipes', label: 'Your Recipe' },
  { key: 'stories', label: 'Your Stories' },
];

function TabButton({ label, active, onPress }) {
  return (
    <TouchableOpacity style={[styles.tab, active && styles.tabActive]} onPress={onPress}>
      <ThemedText
        style={[styles.tabText, active && styles.tabTextActive]}
        lightColor={active ? '#CC684F' : '#666'}
        darkColor={active ? '#CC684F' : '#999'}
      >
        {label}
      </ThemedText>
      {active && <View style={styles.tabUnderline} />}
    </TouchableOpacity>
  );
}

// "Your Recipe" / "Your Stories" switch; onChange receives 'recipes' or 'stories'
export function ProfileTabBar({ activeTab, onChange }) {
  return (
    <View style={styles.tabsContainer}>
      {TABS.map((tab) => (
        <TabButton
          key={tab.key}
          label={tab.label}
          active={activeTab === tab.key}
          onPress={() => onChange(tab.key)}
        />
      ))}
    </View>
  );
}

// Loading text, empty text or one card per row. `list` is { rows, loading } from useProfileData.
function CardGrid({ list, loadingText, emptyText, renderCard }) {
  if (list.loading) return <StatusMessage text={loadingText} variant="loading" color="#999" />;
  if (list.rows.length === 0) return <StatusMessage text={emptyText} variant="empty" color="#999" />;
  return list.rows.map(renderCard);
}

// Cards of the active tab
export function ProfileTabContent({ activeTab, recipes, stories, onOpenRecipe }) {
  return (
    <View style={styles.contentGrid}>
      {activeTab === 'recipes' ? (
        <CardGrid
          list={recipes}
          loadingText="Loading recipes..."
          emptyText="No recipes yet. Create your first recipe!"
          renderCard={(recipe) => (
            <RecipeCard key={recipe.id} recipe={recipe} onPress={() => onOpenRecipe(recipe.id)} />
          )}
        />
      ) : (
        <CardGrid
          list={stories}
          loadingText="Loading stories..."
          emptyText="No stories yet. Share your first story!"
          renderCard={(story) => <StoryCard key={story.id} story={story} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  tabsContainer: {
    flexDirection: 'row',
    marginTop: 24,
    marginBottom: 16,
  },
  tab: {
    paddingBottom: 8,
    marginRight: 24,
  },
  tabActive: {},
  tabText: {
    fontSize: 18,
    fontWeight: '500',
  },
  tabTextActive: {
    fontWeight: '600',
  },
  tabUnderline: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: '#CC684F',
  },
  contentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 8,
  },
});
