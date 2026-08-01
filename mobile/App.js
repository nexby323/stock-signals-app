import React, { useState } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TextInput, 
  TouchableOpacity, 
  KeyboardAvoidingView, 
  Platform,
  Alert 
} from 'react-native';

/**
 * Authentication Screen Component.
 * 
 * Renders a dual-purpose screen for user login and registration.
 * It handles state management for email, password, and error display,
 * utilizing React Native's native Alert component for successful actions.
 *
 * @returns {React.JSX.Element} The rendered authentication screen.
 */
export default function App() {
  // State to toggle between Login (true) and Register (false) modes
  const [isLogin, setIsLogin] = useState(true);
  
  // State variables to store user input
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // State variable to manage inline error messages
  const [errorMessage, setErrorMessage] = useState('');

  /**
   * Validates user input and simulates the authentication process.
   * Displays an inline error if fields are missing, or a native OS Alert upon success.
   */
  const handleAuthentication = () => {
    // Clear any previous errors on new submission attempts
    setErrorMessage('');
    
    // Basic validation: ensure both fields are populated
    if (!email || !password) {
      setErrorMessage('Please fill in all fields.');
      return;
    }

    // Trigger the native OS Alert to indicate successful validation
    Alert.alert(
      isLogin ? "Login Successful" : "Registration Successful",
      `Welcome to the system, ${email}!`,
      [{ text: "OK", onPress: () => console.log("Alert closed") }]
    );
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
      style={styles.container}
    >
      <View style={styles.formContainer}>
        
        {/* Dynamic Screen Headers */}
        <Text style={styles.title}>
          {isLogin ? 'Welcome Back' : 'Create an Account'}
        </Text>
        <Text style={styles.subtitle}>
          {isLogin 
            ? 'Login to the AI Stock Predictor' 
            : 'Join us and get smart market insights'}
        </Text>

        {/* Inline Error Message Display */}
        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

        {/* Email Input Field */}
        <TextInput 
          style={styles.input} 
          placeholder="Email" 
          keyboardType="email-address"
          autoCapitalize="none"
          onChangeText={setEmail} 
          value={email} 
        />
        
        {/* Password Input Field */}
        <TextInput 
          style={styles.input} 
          placeholder="Password" 
          secureTextEntry={true}
          onChangeText={setPassword} 
          value={password} 
        />

        {/* Primary Action Button (Login / Register) */}
        <TouchableOpacity style={styles.primaryButton} onPress={handleAuthentication}>
          <Text style={styles.primaryButtonText}>
            {isLogin ? 'Login' : 'Register Now'}
          </Text>
        </TouchableOpacity>

        {/* Toggle Button to switch between modes */}
        <TouchableOpacity 
          style={styles.switchButton} 
          onPress={() => {
            setIsLogin(!isLogin);
            setEmail('');
            setPassword('');
            setErrorMessage(''); // Clear errors when switching screens
          }}
        >
          <Text style={styles.switchButtonText}>
            {isLogin 
              ? "Don't have an account? Click here to register" 
              : "Already have an account? Login here"}
          </Text>
        </TouchableOpacity>

      </View>
    </KeyboardAvoidingView>
  );
}

// Stylesheet definition using React Native's standard object-based styling
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f4f4f8',
    justifyContent: 'center',
  },
  formContainer: {
    paddingHorizontal: 30,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#64748b',
    marginBottom: 20,
    textAlign: 'center',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 15,
    fontWeight: '500',
  },
  input: {
    backgroundColor: '#ffffff',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 10,
    marginBottom: 15,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  primaryButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  switchButton: {
    marginTop: 20,
    alignItems: 'center',
  },
  switchButtonText: {
    color: '#3b82f6',
    fontSize: 16,
    fontWeight: '600',
  }
});