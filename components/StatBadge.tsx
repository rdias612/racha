import { Text, View } from 'react-native';

export interface StatBadgeProps {
  label: string;
  value: number;
}

export function StatBadge({ label, value }: StatBadgeProps) {
  return (
    <View
      className="min-h-[76px] flex-1 items-center justify-center rounded-xl border border-pitch-200 bg-pitch-50 px-2 py-3"
      accessibilityLabel={`${label}: ${value}`}
    >
      <Text className="text-2xl font-bold text-pitch-900">{value}</Text>
      <Text className="mt-1 text-center text-xs font-semibold text-pitch-600">{label}</Text>
    </View>
  );
}
