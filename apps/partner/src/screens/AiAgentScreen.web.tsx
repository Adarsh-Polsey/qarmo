import React from 'react';
import { StyleSheet, View } from 'react-native';
import { theme } from '@qarmo/ui';
import { BOTPRESS_WEBCHAT_URL } from '../config/botpress';

// react-native-web renders through React DOM, so a raw <iframe> element works
// here and gives us a sandboxed full-page chat with no global-script pollution.
export const AiAgentScreen: React.FC = () => {
  return (
    <View style={styles.container}>
      {React.createElement('iframe', {
        src: BOTPRESS_WEBCHAT_URL,
        title: 'AI Agent',
        style: {
          border: 'none',
          width: '100%',
          height: '100%',
          display: 'block',
          backgroundColor: theme.colors.background,
        },
        allow: 'microphone; clipboard-write',
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
});
