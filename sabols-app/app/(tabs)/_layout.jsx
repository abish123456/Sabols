import { Tabs } from 'expo-router';
import { Store, ShoppingCart, Package, User } from 'lucide-react-native';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerTitleAlign: 'left',
        headerTitle: 'SABOLS',
        headerStyle: {
          backgroundColor: '#f3f7fb',
        },
        headerShadowVisible: false,
        tabBarActiveTintColor: '#0ea5e9',
        tabBarInactiveTintColor: '#64748b',
        tabBarStyle: {
          borderTopWidth: 1,
          borderTopColor: '#e2e8f0',
        },
      }}
    >
      <Tabs.Screen
        name="items"
        options={{
          title: 'Home',
          headerShown: false,
          tabBarIcon: ({ color }) => <Store size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="cart"
        options={{
          title: 'Cart',
          tabBarIcon: ({ color }) => <ShoppingCart size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: 'Orders',
          tabBarIcon: ({ color }) => <Package size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <User size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="order"
        options={{
          title: 'Checkout',
          href: null,
        }}
      />
    </Tabs>
  );
}
