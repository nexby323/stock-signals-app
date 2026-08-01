import React, { useState } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TextInput, 
  TouchableOpacity, 
  KeyboardAvoidingView, 
  Platform 
} from 'react-native';
//for knowing the ipv4 of the computer that run the server
import Constants from 'expo-constants';
// Navigation Imports
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';


/**
 * Authentication Screen 
 */
function AuthScreen({ navigation }) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  /**
 * Automatically detects the local machine's IP address during development.
 * This prevents the need to hardcode dynamic local IP addresses.
 */
const getServerUrl = () => {
  // If the app is compiled for production, return the real internet URL
  if (!__DEV__) {
    return 'https://your-real-domain.com'; // You will change this when you deploy the server
  }

  // Extract the IP address that Expo uses to communicate with the phone
  const hostUri = Constants?.expoConfig?.hostUri;
  
  if (hostUri) {
    // hostUri usually looks like "192.168.1.15:8081"
    // We split it by ':' to get just the IP, and attach our Node.js port (3000)
    return `http://${hostUri.split(':')[0]}:3000`;
  }

  // Fallback just in case something fails
  return 'http://localhost:3000';
};

// Store the detected URL globally for the app to use
const SERVER_URL = getServerUrl();
  /*
    you need to do all the Authintication things, the client side fetch the data
    (email and password - need to add all the other feilds for the registretion)
    but the path to this we need to put on the server.js 
    and on the server code this is the place when we need 
    SQL queries to the db (update for regestration and validate login)
  */

  /**
   * Handles user authentication by sending a POST request to the Node.js backend.
   */
  const handleAuthentication = async () => {
    setErrorMessage('');
    
    if (!email || !password) {
      setErrorMessage('Please fill in all fields.');
      return;
    }

    try {
      
      
      // Determine the correct endpoint based on the current mode
      const endpoint = isLogin ? '/api/login' : '/api/register';

      // Send the HTTP POST request to the server
      const response = await fetch(`${SERVER_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        // Send the email and password as a JSON string
        body: JSON.stringify({
          email: email,
          password: password
        })
      });

      // Parse the JSON response from the server
      const data = await response.json();

      // Check if the HTTP status code is in the success range (200-299)
      if (response.ok) {
        // Success! Navigate to the Home screen and pass the email
        navigation.replace('Home', { userEmail: email });
      } else {
        // Server returned an error (e.g., incorrect password, user already exists)
        setErrorMessage(data.error || 'Authentication failed. Please try again.');
      }

    } catch (error) {
      // This catches network errors (e.g., server is down, wrong IP address)
      console.error("Network Error:", error);
      setErrorMessage('Network error. Check your server connection and IP address.');
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <View style={styles.formContainer}>
        <Text style={styles.title}>{isLogin ? 'Welcome Back' : 'Create an Account'}</Text>
        <Text style={styles.subtitle}>Login to the AI Stock Predictor</Text>

        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

        <TextInput 
          style={styles.input} 
          placeholder="Email" 
          keyboardType="email-address"
          autoCapitalize="none" 
          onChangeText={setEmail} 
          value={email} 
        />
        
        <TextInput 
          style={styles.input} 
          placeholder="Password" 
          secureTextEntry={true} 
          onChangeText={setPassword} 
          value={password} 
        />

        <TouchableOpacity style={styles.primaryButton} onPress={handleAuthentication}>
          <Text style={styles.primaryButtonText}>{isLogin ? 'Login' : 'Register'}</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.switchButton} 
          onPress={() => { 
            setIsLogin(!isLogin); 
            setErrorMessage(''); 
          }}
        >
          <Text style={styles.switchButtonText}>
            {isLogin ? "Don't have an account? Register" : "Already have an account? Login"}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

/**
 * Home / Dashboard Screen
 */
function HomeScreen({ route, navigation }) {
  const { userEmail } = route.params || { userEmail: 'User' };

  return (
    <View style={styles.dashboardContainer}>
      <Text style={styles.dashboardTitle}>AI Stock Dashboard</Text>
      <Text style={styles.dashboardSubtitle}>Logged in as: {userEmail}</Text>
      
      <View style={styles.chartPlaceholder}>
        <Text style={styles.chartText}>AI Predictions Chart Will Go Here</Text>
      </View>

      <TouchableOpacity 
        style={styles.logoutButton} 
        onPress={() => navigation.replace('Auth')} 
      >
        <Text style={styles.primaryButtonText}>Log Out</Text>
      </TouchableOpacity>
    </View>
  );
}

// Create the Stack Navigator
const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Auth">
        <Stack.Screen name="Auth" component={AuthScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'Dashboard', headerBackVisible: false }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

// Styles
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f4f8', justifyContent: 'center' },
  formContainer: { paddingHorizontal: 30 },
  title: { fontSize: 32, fontWeight: 'bold', color: '#1e293b', marginBottom: 10, textAlign: 'center' },
  subtitle: { fontSize: 16, color: '#64748b', marginBottom: 20, textAlign: 'center' },
  errorText: { color: '#ef4444', fontSize: 14, textAlign: 'center', marginBottom: 15, fontWeight: '500' },
  input: { backgroundColor: '#ffffff', paddingVertical: 15, paddingHorizontal: 20, borderRadius: 10, marginBottom: 15, fontSize: 16, borderWidth: 1, borderColor: '#e2e8f0' },
  primaryButton: { backgroundColor: '#3b82f6', paddingVertical: 15, borderRadius: 10, alignItems: 'center', marginTop: 10 },
  primaryButtonText: { color: '#ffffff', fontSize: 18, fontWeight: 'bold' },
  switchButton: { marginTop: 20, alignItems: 'center' },
  switchButtonText: { color: '#3b82f6', fontSize: 16, fontWeight: '600' },
  dashboardContainer: { flex: 1, padding: 20, backgroundColor: '#f4f4f8', alignItems: 'center' },
  dashboardTitle: { fontSize: 28, fontWeight: 'bold', color: '#0f172a', marginTop: 20 },
  dashboardSubtitle: { fontSize: 16, color: '#475569', marginBottom: 40 },
  chartPlaceholder: { width: '100%', height: 250, backgroundColor: '#e2e8f0', borderRadius: 15, justifyContent: 'center', alignItems: 'center', marginBottom: 40, borderWidth: 1, borderColor: '#cbd5e1', borderStyle: 'dashed' },
  chartText: { color: '#64748b', fontWeight: 'bold', fontSize: 16 },
  logoutButton: { backgroundColor: '#ef4444', paddingVertical: 15, paddingHorizontal: 40, borderRadius: 10, alignItems: 'center' }
});