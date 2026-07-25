import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, theme } from '@qarmo/ui';
import { supabase } from '@qarmo/supabase';
import { useTranslation } from '@qarmo/i18n';

export const GlobalCounter: React.FC = () => {
  const { t } = useTranslation();
  const [count, setCount] = useState<number>(0);

  useEffect(() => {
    const fetchCount = async () => {
      const { count: currentCount, error } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('account_type', 'partner');
      
      if (!error && currentCount !== null) {
        setCount(currentCount);
      }
    };

    fetchCount();

    const channel = supabase
      .channel('public:profiles')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'profiles' },
        (payload) => {
          if (payload.new && payload.new.account_type === 'partner') {
            setCount((c) => c + 1);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles' },
        (payload) => {
          // If someone completes profile and becomes partner
          if (
            payload.old && payload.new && 
            payload.old.account_type !== 'partner' && 
            payload.new.account_type === 'partner'
          ) {
            setCount((c) => c + 1);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  let text = t('counter.partners', { count, defaultValue: `${count} partners on Qarmo` });
  if (count === 1) {
    text = t('counter.partner_singular', { defaultValue: `1 partner on Qarmo` });
  } else if (count === 0) {
    text = t('counter.zero', { defaultValue: `Be the first — invite a friend` });
  }

  return (
    <View style={styles.container}>
      <Text variant="body" style={styles.text}>
        🎉 {text}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.surface,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontWeight: '600',
    color: theme.colors.ink,
  },
});
