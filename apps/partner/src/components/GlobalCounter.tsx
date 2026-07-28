import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, theme, IconConfetti } from '@qarmo/ui';
import { supabase } from '@qarmo/supabase';
import { useTranslation } from '@qarmo/i18n';

export const GlobalCounter: React.FC = () => {
  const { t } = useTranslation();
  const [count, setCount] = useState<number>(0);

  useEffect(() => {
    const fetchCount = async () => {
      // 1. Try get_partner_count RPC (security definer bypassing RLS)
      try {
        const { data: rpcCount, error: rpcErr } = await supabase.rpc('get_partner_count' as any);
        if (!rpcErr && typeof rpcCount === 'number' && rpcCount > 0) {
          setCount(rpcCount);
          return;
        }
      } catch {
        // RPC not deployed yet, proceed to table count
      }

      // 2. Table select query
      const { count: currentCount, error } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('account_type', 'partner');

      if (!error && currentCount !== null && currentCount > 0) {
        setCount(currentCount);
      } else {
        // At minimum the logged in user exists on Qarmo
        setCount(1);
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
            setCount((c) => Math.max(1, c + 1));
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles' },
        (payload) => {
          if (
            payload.old && payload.new && 
            payload.old.account_type !== 'partner' && 
            payload.new.account_type === 'partner'
          ) {
            setCount((c) => Math.max(1, c + 1));
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
      <IconConfetti size={16} color={theme.colors.ink} />
      <Text variant="body" style={styles.text}>
        {text}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: theme.spacing.xs,
    backgroundColor: theme.colors.surface,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontFamily: theme.fonts.medium,
    fontWeight: '500',
    color: theme.colors.ink,
  },
});
