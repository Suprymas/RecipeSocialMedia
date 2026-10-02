import { View, useColorScheme } from 'react-native';

export function ThemedView({ style, lightColor, darkColor, ...otherProps }) {
  const colorScheme = useColorScheme();

  // Default background colors
  const defaultLightColor = '#fff';
  const defaultDarkColor = '#151718';

  // Determine the background color based on theme
  const backgroundColor = colorScheme === 'dark'
    ? (darkColor || defaultDarkColor)
    : (lightColor || defaultLightColor);

  return <View style={[{ backgroundColor }, style]} {...otherProps} />;
}