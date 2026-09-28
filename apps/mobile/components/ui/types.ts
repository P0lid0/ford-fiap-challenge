import type { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';

/** Nome de qualquer ícone do Ionicons (autocompleta no editor). */
export type IconName = ComponentProps<typeof Ionicons>['name'];
