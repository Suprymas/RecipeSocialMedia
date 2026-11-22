import { StyleSheet, View } from 'react-native';
import { ThemedText } from '../../../components/ThemedText';

// A centred line of text for loading, empty and error states.
// variant: 'loading' | 'error' | 'empty' | 'emptyList'
export function StatusMessage({ text, variant, color }) {
  const look = VARIANTS[variant];
  return (
    <View style={look.container}>
      <ThemedText style={look.text} lightColor={color} darkColor={color}>
        {text}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    fontSize: 16,
    color: '#fff',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#fff',
    textAlign: 'center',
  },
  emptyContainer: {
    width: '100%',
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
  },
  emptyListContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyListText: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
  },
});

const VARIANTS = {
  loading: { container: styles.loadingContainer, text: styles.loadingText },
  error: { container: styles.errorContainer, text: styles.errorText },
  empty: { container: styles.emptyContainer, text: styles.emptyText },
  emptyList: { container: styles.emptyListContainer, text: styles.emptyListText },
};
