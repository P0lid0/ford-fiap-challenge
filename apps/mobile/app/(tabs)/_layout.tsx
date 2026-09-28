import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { IconName } from '../../components/ui';
import { colors, fonts, surface } from '../../lib/theme';

type TabConfig = {
  name: string;
  title: string;
  icon: IconName;
  iconFocused: IconName;
};

const TABS: TabConfig[] = [
  { name: 'index', title: 'Carteira', icon: 'people-outline', iconFocused: 'people' },
  { name: 'leads', title: 'Leads', icon: 'alert-circle-outline', iconFocused: 'alert-circle' },
  { name: 'vehicles', title: 'Concorrência', icon: 'car-sport-outline', iconFocused: 'car-sport' },
  { name: 'insights', title: 'Insights', icon: 'sparkles-outline', iconFocused: 'sparkles' },
];

/** Altura útil da barra (ícone + rótulo), sem contar a área segura inferior. */
const TAB_BAR_CONTENT_HEIGHT = 66;

/**
 * Barra de abas. A altura soma a área segura inferior do aparelho — assim os
 * rótulos não são cortados nem ficam atrás da barra de gestos/botões do Android.
 */
export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.fordBlue,
        tabBarInactiveTintColor: surface.textMuted,
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          backgroundColor: surface.card,
          borderTopColor: surface.border,
          height: TAB_BAR_CONTENT_HEIGHT + insets.bottom,
          paddingTop: 4,
          paddingBottom: insets.bottom + 4,
        },
        tabBarItemStyle: { paddingVertical: 2 },
        tabBarLabelStyle: { fontFamily: fonts.semibold, fontSize: 11, lineHeight: 14 },
        tabBarAllowFontScaling: false,
      }}
    >
      {TABS.map(tab => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            tabBarIcon: ({ color, size, focused }) => (
              <Ionicons name={focused ? tab.iconFocused : tab.icon} size={size} color={color} />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
