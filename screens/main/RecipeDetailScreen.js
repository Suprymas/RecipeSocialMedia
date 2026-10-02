import { ThemedText } from '../../components/ThemedText';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
  Text,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { backend } from '../../services/Backend';

export default function RecipeDetailScreen(props) {
  const navigation = useNavigation();
  const route = useRoute();
  const { id } = route.params || {};

  const [recipe, setRecipe] = useState();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [story, setStory] = useState('');
  const [cookDetails, setCookDetails] = useState('');
  const [ingredientsList, setIngredienList] = useState([]);
  const [stepsList, setStepsList] = useState([]);

  console.log(id);
  useEffect(() => {
    const getRecipe = async () => {
      const { data: { user } } = await backend.auth.getUser();
      const { data: recipeData, error: recipeError } = await backend.rpc("get_recipe", { p_recipe_id: id })
      const { data: username, error: UserError } = await backend.from('profiles').select('username').eq('id', recipeData.recipe.user_id);
      //console.error(UserError);
      setIngredienList(recipeData.ingredients);
      setStepsList(recipeData.steps);
      setRecipe({ ...recipeData.recipe, username: username[0].username });
      setLoading(false)
      console.log("current", recipe)
    }
    getRecipe();

  }, [id])

  // Parse ingredients into array - support both newline and comma separators

  // Parse instructions into steps
  //const stepsList = recipe.instructions?.split('\n').filter(step => step.trim()) || [];

  const formatDate = (dateString) => {
    try {
      return new Date(dateString).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    } catch (error) {
      return dateString;
    }
  };

  // Generate step images based on step index and recipe
  const getStepImageUrl = (stepIndex, totalSteps) => {
    // Use Unsplash curated food images for variety
    // Different image IDs for different steps to show variety
    const imageIds = [
      '1513104890138-7c749659a591', // cooking prep
      '1555939594-58d7cb561ad1',   // ingredients
      '1484723091739-30a097e8f929', // mixing
      '1568901346375-23c9450c58cd', // cooking
      '1541519227354-08fa5d50c44d', // plating
      '1579584425555-c3ce17fd4351', // garnishing
      '1512621776951-a57141f2eefd', // final dish
      '1504674900247-0877df9cc836', // baking
    ];

    const imageId = imageIds[stepIndex % imageIds.length] || imageIds[0];
    return `https://images.unsplash.com/photo-${imageId}?w=400&h=300&fit=crop&auto=format`;
  };

  const handlePreviousRecipe = () => {
    const currentId = parseInt(id || '1', 10);
    const prevId = currentId - 1;
    if (prevId > 0) {
      navigation.push('RecipeDetail', { id: prevId });
    }
  };

  const handleNextRecipe = () => {
    const currentId = parseInt(id || '1', 10);
    const nextId = currentId + 1;
    navigation.push('RecipeDetail', { id: nextId });
  };
  if (loading) {
    return (
      <Text>Loading</Text>

    )
  }
  return (
    <View style={styles.outerContainer}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Main Recipe Image */}
        <View style={styles.imageContainer}>
          {recipe.main_image_url ? (
            <Image
              source={{ uri: recipe.main_image_url }}
              style={styles.mainImage}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.imagePlaceholder}>
              <ThemedText style={styles.placeholderIcon}>🏔️☀️</ThemedText>
            </View>
          )}
        </View>

        {/* Content Section - Yellow-Orange Background */}
        <View style={styles.contentSection}>
          {/* Name of recipe with author */}
          <View style={styles.recipeHeader}>
            <View style={styles.recipeTitleRow}>
              <ThemedText style={styles.recipeTitle}>{recipe.title}</ThemedText>
              <View style={styles.authorRow}>
                <View style={styles.authorAvatar} />
                <ThemedText style={styles.authorName}>
                  {recipe.username || 'Unknown'}
                </ThemedText>
              </View>
            </View>
          </View>

          {/* Story behind this Dish */}
          <View style={styles.inputSection}>
            <ThemedText style={styles.sectionLabel}>Story behind this Dish</ThemedText>
            <View style={styles.textDisplay}>
              <ThemedText style={styles.textDisplayContent}>{story}</ThemedText>
            </View>
          </View>

          {/* Ingredients */}
          <View style={styles.ingredientsSection}>
            <ThemedText style={styles.sectionLabel}>Ingredients</ThemedText>
            {ingredientsList.length > 0 ? (
              <View style={styles.ingredientsContainer}>
                {ingredientsList.map((ingredient) => {
                  //add amount 
                  let amount = 0;
                  return (
                    <View key={`ingredient-${ingredient.order_index}`}>
                      <View style={styles.ingredientRow}>
                        <ThemedText style={styles.ingredientText}>
                          {`${ingredient.ingredient}${amount ? `: ${amount}` : ''}`}
                        </ThemedText>
                      </View>
                      {!(ingredient.order_index != ingredientsList.length - 1) && <View style={styles.ingredientSeparator} />}
                    </View>
                  );
                })}
              </View>
            ) : (
              <ThemedText style={styles.emptyText}>No ingredients listed</ThemedText>
            )}
          </View>

          {/* Steps */}
          {stepsList.length > 0 ? (
            stepsList.map((step, index) => {
              const stepImageUrl = getStepImageUrl(index, stepsList.length);
              return (
                <View key={`step-${index}`} style={styles.stepSection}>
                  <ThemedText style={styles.sectionLabel}>{index + 1}. step</ThemedText>
                  <View style={styles.stepImageContainer}>
                    <Image
                      source={{ uri: step.image_url }}
                      style={styles.stepImage}
                      resizeMode="cover"
                    />
                  </View>
                  {index === 0 && (
                    <View style={styles.cookDetailsSection}>
                      <View style={styles.textDisplay}>
                        <ThemedText style={styles.textDisplayContent}>
                          {step.description}
                        </ThemedText>
                      </View>
                    </View>
                  )}
                </View>
              );
            })
          ) : (
            <View style={styles.stepSection}>
              <ThemedText style={styles.emptyText}>No steps listed</ThemedText>
            </View>
          )}

          {/* Updated date */}
          <View style={styles.dateRow}>
            <ThemedText style={styles.dateText}>
              Updated on {formatDate(recipe.updated_at)}
            </ThemedText>
          </View>

          {/* Comments Section */}
          <View style={styles.commentsSection}>
            <ThemedText style={styles.sectionLabel}>Comments</ThemedText>
            <View style={styles.commentCard}>
              <View style={styles.commentHeader}>
                <View style={styles.commentAvatar} />
                <ThemedText style={styles.commentUserName}>User name</ThemedText>
              </View>
              <ThemedText style={styles.commentText}>
                Looks very delicious!
              </ThemedText>
            </View>
          </View>

          {/* Navigation Buttons */}
          <View style={styles.navigationButtons}>
            <TouchableOpacity
              style={styles.navButton}
              onPress={handlePreviousRecipe}
            >
              <ThemedText style={styles.navButtonText}>Last recipe</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.navButton}
              onPress={handleNextRecipe}
            >
              <ThemedText style={styles.navButtonText}>Next recipe</ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    backgroundColor: '#CC684F',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  imageContainer: {
    width: '100%',
    height: 250,
    backgroundColor: '#E0E0E0',
  },
  mainImage: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderIcon: {
    fontSize: 48,
  },
  contentSection: {
    backgroundColor: '#6F6C6C', // Gray background
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 40,
  },
  recipeHeader: {
    marginBottom: 20,
  },
  recipeTitleRow: {
    marginBottom: 12,
  },
  recipeTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
    marginBottom: 8,
  },
  sectionLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000', // Black for better contrast
    marginBottom: 8,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  authorAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E0E0E0',
    marginRight: 8,
  },
  authorName: {
    fontSize: 16,
    color: '#000',
    fontWeight: '500',
  },
  inputSection: {
    marginBottom: 24,
  },
  textInput: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#000',
    minHeight: 44,
    textAlignVertical: 'top',
  },
  textDisplay: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    minHeight: 44,
  },
  textDisplayContent: {
    fontSize: 16,
    color: '#000',
    lineHeight: 22,
  },
  ingredientsSection: {
    width: '100%',
    marginBottom: 24,
  },
  ingredientsContainer: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
  },
  ingredientRow: {
    width: '100%',
    paddingVertical: 8,
  },
  ingredientSeparator: {
    width: '100%',
    height: 1,
    backgroundColor: '#E0E0E0',
    marginVertical: 0,
  },
  ingredientText: {
    fontSize: 16,
    color: '#000',
    lineHeight: 22,
  },
  stepSection: {
    marginBottom: 24,
  },
  stepImageContainer: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 12,
    backgroundColor: '#E0E0E0',
  },
  stepImage: {
    width: '100%',
    height: '100%',
  },
  stepImagePlaceholder: {
    width: '100%',
    height: 150,
    backgroundColor: '#E0E0E0',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  cookDetailsSection: {
    marginTop: 12,
  },
  dateRow: {
    alignItems: 'flex-end',
    marginBottom: 24,
  },
  dateText: {
    fontSize: 12,
    color: '#666',
  },
  commentsSection: {
    marginBottom: 24,
  },
  commentCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginTop: 12,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  commentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E0E0E0',
    marginRight: 8,
  },
  commentUserName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
  },
  commentText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  navigationButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  navButton: {
    backgroundColor: '#CC684F',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 20,
    flex: 1,
    marginHorizontal: 8,
  },
  navButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
  errorText: {
    color: '#CC684F',
    marginBottom: 12,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    alignSelf: 'center',
    marginTop: 12,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
});
