import React, { useState } from 'react';
import {
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { ThemedText } from '../../components/ThemedText';
import { backend, uploadImage } from '../../services/Backend';
import { useNavigation } from '@react-navigation/native';

export default function PublishRecipeScreen() {
  const navigation = useNavigation();

  const [title, setTitle] = useState('');
  const [story, setStory] = useState('');
  const [tags, setTags] = useState('');
  const [ingredients, setIngredients] = useState(['']);
  const [preparationSteps, setPreparationSteps] = useState([
    { id: 1, description: '' },
  ]);
  const [mainImageUri, setMainImageUri] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleAddIngredient = () => {
    setIngredients([...ingredients, '']);
  };

  const handleIngredientChange = (index, value) => {
    const newIngredients = [...ingredients];
    newIngredients[index] = value;
    setIngredients(newIngredients);
  };

  const handleAddStep = () => {
    const newStepId = preparationSteps.length + 1;
    setPreparationSteps([...preparationSteps, { id: newStepId, description: '' }]);
  };

  const handleStepChange = (stepId, value) => {
    const newSteps = preparationSteps.map(step =>
      step.id === stepId ? { ...step, description: value } : step
    );
    setPreparationSteps(newSteps);
  };

  const handleStepImageChange = (stepId, imageUri) => {
    const newSteps = preparationSteps.map(step =>
      step.id === stepId ? { ...step, imageUri } : step
    );
    setPreparationSteps(newSteps);
  };

  const requestPermissions = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to your photos to upload images.');
      return false;
    }
    return true;
  };

  const pickMainImage = async () => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.8,
      });

      if (!result.canceled) {
        setMainImageUri(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const pickStepImage = async (stepId) => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled) {
        handleStepImageChange(stepId, result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const handlePost = async () => {
    // Validate required fields
    if (!title || !ingredients.some(ing => ing.trim()) || !preparationSteps.some(step => step.description.trim())) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    setLoading(true);

    try {
      // Get current user
      const { data: { user } } = await backend.auth.getUser();

      if (!user) {
        Alert.alert('Error', 'You must be logged in to post a recipe');
        setLoading(false);
        return;
      }

      // Upload main image if exists
      let mainImageUrl = null;
      if (mainImageUri) {
        mainImageUrl = await uploadImage(mainImageUri, 'recipe-images', `main/${user.id}`);
      }

      // Parse tags (comma-separated string to array)
      const tagsArray = tags
        .split(',')
        .map(tag => tag.trim())
        .filter(tag => tag.length > 0);

      // Insert recipe
      const { data: recipe, error: recipeError } = await backend
        .from('recipes')
        .insert({
          user_id: user.id,
          title,
          story: story || null,
          tags: tagsArray,
          main_image_url: mainImageUrl,
        })
        .select()
        .single();

      if (recipeError) throw recipeError;

      // Insert ingredients
      const ingredientsData = ingredients
        .filter(ing => ing.trim())
        .map((ingredient, index) => ({
          recipe_id: recipe.id,
          ingredient: ingredient.trim(),
          order_index: index,
        }));

      if (ingredientsData.length > 0) {
        const { error: ingredientsError } = await backend
          .from('recipe_ingredients')
          .insert(ingredientsData);

        if (ingredientsError) throw ingredientsError;
      }

      // Upload step images and insert steps
      const stepsData = await Promise.all(
        preparationSteps
          .filter(step => step.description.trim())
          .map(async (step, index) => {
            let stepImageUrl = null;
            if (step.imageUri) {
              stepImageUrl = await uploadImage(
                step.imageUri,
                'recipe-images',
                `steps/${user.id}/${recipe.id}`
              );
            }

            return {
              recipe_id: recipe.id,
              step_number: index + 1,
              description: step.description.trim(),
              image_url: stepImageUrl,
            };
          })
      );

      if (stepsData.length > 0) {
        const { error: stepsError } = await backend
          .from('recipe_steps')
          .insert(stepsData);

        if (stepsError) throw stepsError;
      }
      // Success!
      Alert.alert('Success', 'Recipe created successfully!', [
        {
          text: "OK",
          onPress: () => {
            // Navigate to the new recipe on successfully creating the recipe
            navigation.navigate('RecipeDetail', { id: recipe.id });
          }
        },
        {
          text: 'Add annother',
          onPress: () => {
            // Clear form
            setTitle('');
            setStory('');
            setTags('');
            setIngredients(['']);
            setPreparationSteps([{ id: 1, description: '' }]);
            setMainImageUri(null);
          },
        },
      ]);
    } catch (error) {
      console.error('Error creating recipe:', error);
      Alert.alert('Error', `Failed to create recipe: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Clear Form',
      'Are you sure you want to clear all fields?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => {
            setTitle('');
            setStory('');
            setTags('');
            setIngredients(['']);
            setPreparationSteps([{ id: 1, description: '' }]);
            setMainImageUri(null);
          },
        },
      ]
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.outerContainer}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header */}
      <View style={styles.header}>
        <ThemedText style={styles.headerText}>Add a new recipe</ThemedText>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Main Image Upload Area */}
        <TouchableOpacity
          style={styles.mainImageContainer}
          onPress={pickMainImage}
          activeOpacity={0.8}
        >
          {mainImageUri ? (
            <Image source={{ uri: mainImageUri }} style={styles.mainImage} resizeMode="cover" />
          ) : (
            <View style={styles.imagePlaceholder}>
              <ThemedText style={styles.placeholderIcon}>🏔️☀️</ThemedText>
              <ThemedText style={styles.placeholderText}>Tap to add main image</ThemedText>
            </View>
          )}
        </TouchableOpacity>

        {/* Content Section */}
        <View style={styles.contentSection}>
          {/* Name of recipe */}
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="Name of recipe"
            placeholderTextColor="#999"
          />

          {/* Story behind this Dish */}
          <TextInput
            style={[styles.input, styles.textArea]}
            value={story}
            onChangeText={setStory}
            placeholder="Story behind this Dish"
            placeholderTextColor="#999"
            multiline
            textAlignVertical="top"
          />

          {/* Choose tags */}
          <TextInput
            style={styles.input}
            value={tags}
            onChangeText={setTags}
            placeholder="Choose tags (comma-separated)"
            placeholderTextColor="#999"
          />

          {/* Ingredients Section */}
          <ThemedText style={styles.sectionLabel}>Ingredients</ThemedText>
          {ingredients.map((ingredient, index) => (
            <TextInput
              key={index}
              style={styles.input}
              value={ingredient}
              onChangeText={(value) => handleIngredientChange(index, value)}
              placeholder="Choose ingredients"
              placeholderTextColor="#999"
            />
          ))}
          <TouchableOpacity
            style={styles.addButton}
            onPress={handleAddIngredient}
            activeOpacity={0.8}
          >
            <ThemedText style={styles.addButtonText}>Add extra ingredient</ThemedText>
          </TouchableOpacity>

          {/* Preparation Section */}
          <ThemedText style={styles.sectionLabel}>Preparation</ThemedText>
          {preparationSteps.map((step, index) => (
            <View key={step.id} style={styles.stepContainer}>
              <ThemedText style={styles.stepLabel}>{index + 1}. step</ThemedText>
              <TouchableOpacity
                style={styles.stepImageContainer}
                onPress={() => pickStepImage(step.id)}
                activeOpacity={0.8}
              >
                {step.imageUri ? (
                  <Image
                    source={{ uri: step.imageUri }}
                    style={styles.stepImage}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.stepImagePlaceholder}>
                    <ThemedText style={styles.placeholderIcon}>🏔️☀️</ThemedText>
                    <ThemedText style={styles.placeholderTextSmall}>Tap to add image</ThemedText>
                  </View>
                )}
              </TouchableOpacity>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={step.description}
                onChangeText={(value) => handleStepChange(step.id, value)}
                placeholder="description"
                placeholderTextColor="#999"
                multiline
                textAlignVertical="top"
              />
            </View>
          ))}
          <TouchableOpacity
            style={styles.addButton}
            onPress={handleAddStep}
            activeOpacity={0.8}
          >
            <ThemedText style={styles.addButtonText}>Add extra steps</ThemedText>
          </TouchableOpacity>

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.actionButton, styles.deleteButton]}
              onPress={handleDelete}
              activeOpacity={0.8}
              disabled={loading}
            >
              <ThemedText style={styles.actionButtonText}>Clear</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.postButton, loading && styles.disabledButton]}
              onPress={handlePost}
              disabled={loading}
              activeOpacity={0.8}
            >
              <ThemedText style={styles.actionButtonText}>
                {loading ? 'Posting...' : 'Post'}
              </ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    backgroundColor: '#2C2C2C',
  },
  header: {
    backgroundColor: '#CC684F',
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  headerText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 300,
  },
  mainImageContainer: {
    width: '100%',
    height: 250,
    backgroundColor: '#E0E0E0',
    borderLeftWidth: 2,
    borderRightWidth: 2,
    borderBottomWidth: 2,
    borderColor: '#4A90E2',
    overflow: 'hidden',
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
    color: '#999',
  },
  placeholderText: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
  },
  placeholderTextSmall: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  contentSection: {
    backgroundColor: '#2C2C2C',
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 40,
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#000',
    minHeight: 44,
    marginBottom: 16,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  sectionLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginTop: 8,
    marginBottom: 12,
  },
  stepContainer: {
    marginBottom: 20,
  },
  stepLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  stepImageContainer: {
    width: '100%',
    height: 150,
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
    height: '100%',
    backgroundColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButton: {
    backgroundColor: '#CC684F',
    borderRadius: 6,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24,
    gap: 12,
  },
  actionButton: {
    flex: 1,
    borderRadius: 6,
    paddingVertical: 12,
    alignItems: 'center',
  },
  deleteButton: {
    backgroundColor: '#CC684F',
  },
  postButton: {
    backgroundColor: '#CC684F',
  },
  disabledButton: {
    opacity: 0.6,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
