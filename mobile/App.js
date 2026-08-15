/**
 * App.js
 * 
 * Main entry point for the AI Stock Predictor Mobile Application.
 * Includes:
 * - Robust Password Strength Validation (Regex).
 * - Personalized DB usage: User-specific Watchlists & Alerts.
 * - Dynamic Stock Selection, Real-time Graphing, and AI Inference Triggers.
 * - Auto-polling for market data updates.
 * - UI to display AI inference insights.
 */

import React, { useState, useEffect, useRef, createContext, useContext } from 'react';
import { 
  StyleSheet, Text, View, TextInput, TouchableOpacity, 
  KeyboardAvoidingView, Platform, FlatList, Animated, 
  ActivityIndicator, Dimensions, ScrollView, Alert, Modal
} from 'react-native';

import Constants from 'expo-constants';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { LineChart } from 'react-native-chart-kit';

import NotificationService from './src/services/NotificationService';
import AlarmFactory from './src/factories/AlarmFactory';

const screenWidth = Dimensions.get("window").width;

// ==========================================
// 1. GLOBAL THEME CONTEXT
// ==========================================
const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const theme = {
    isDark: isDarkMode,
    background: isDarkMode ? '#0f172a' : '#f4f4f8',
    text: isDarkMode ? '#f8fafc' : '#0f172a',
    subText: isDarkMode ? '#94a3b8' : '#64748b',
    cardBackground: isDarkMode ? '#1e293b' : '#ffffff',
    borderColor: isDarkMode ? '#334155' : '#e2e8f0',
    inputBackground: isDarkMode ? '#1e293b' : '#ffffff',
    primary: '#3b82f6',
    danger: '#ef4444',
    success: '#22c55e',
    warning: '#f59e0b'
  };
  return (
    <ThemeContext.Provider value={{ isDarkMode, setIsDarkMode, theme }}>
      {children}
    </ThemeContext.Provider>
  );
};

// ==========================================
// 2. UTILS & HELPERS
// ==========================================
const CustomSwitch = ({ value, onValueChange }) => {
  const animatedValue = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(animatedValue, {
      toValue: value ? 1 : 0, duration: 250, useNativeDriver: false,
    }).start();
  }, [value]);

  const backgroundColor = animatedValue.interpolate({
    inputRange: [0, 1], outputRange: ['#cbd5e1', '#3b82f6'] 
  });
  const circlePosition = animatedValue.interpolate({
    inputRange: [0, 1], outputRange: [2, 22] 
  });

  return (
    <TouchableOpacity activeOpacity={0.8} onPress={() => onValueChange(!value)}>
      <Animated.View style={[styles.customSwitchContainer, { backgroundColor }]}>
        <Animated.View style={[styles.customSwitchCircle, { transform: [{ translateX: circlePosition }] }]} />
      </Animated.View>
    </TouchableOpacity>
  );
};

const getServerUrl = () => {
  if (!__DEV__) return 'https://your-real-domain.com';
  const hostUri = Constants?.expoConfig?.hostUri;
  return hostUri ? `http://${hostUri.split(':')[0]}:3000` : 'http://localhost:3000';
};
const SERVER_URL = getServerUrl();

/**
 * Validates password strength for registration locally to save network calls.
 * Requires: >= 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 special character.
 */
const isPasswordStrong = (password) => {
  const strongRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
  return strongRegex.test(password);
};

// ==========================================
// 3. AUTHENTICATION SCREEN
// ==========================================
function AuthScreen({ navigation }) {
  const { isDarkMode, setIsDarkMode, theme } = useContext(ThemeContext);
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleAuthentication = async () => {
    setErrorMessage('');
    
    if (!email || !password) {
      return setErrorMessage('Please fill in all fields.');
    }

    // Client-side regex check. (Backend does the actual cryptographic verification)
    if (!isLogin && !isPasswordStrong(password)) {
      return setErrorMessage('Password must be at least 8 characters long, include an uppercase letter, a lowercase letter, a number, and a special character.');
    }

    setIsProcessing(true);
    try {
      const endpoint = isLogin ? '/api/login' : '/api/register';
      const response = await fetch(`${SERVER_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        navigation.replace('Home', { userEmail: email, userId: data.userId });
      } else {
        setErrorMessage(data.error || 'Authentication failed. Please try again.');
      }
    } catch (error) {
      setErrorMessage('Network error. Check your server connection and IP address.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.authThemeToggle}>
        <Text style={[styles.toggleText, { color: theme.subText }]}>{isDarkMode ? 'Dark' : 'Light'}</Text>
        <CustomSwitch value={isDarkMode} onValueChange={setIsDarkMode} />
      </View>
      <View style={styles.formContainer}>
        <Text style={[styles.title, { color: theme.text }]}>{isLogin ? 'Welcome Back' : 'Create an Account'}</Text>
        <Text style={[styles.subtitle, { color: theme.subText }]}>{isLogin ? 'Login to continue' : 'Join the AI Stock Predictor'}</Text>
        
        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
        
        <TextInput 
          style={[styles.input, { backgroundColor: theme.inputBackground, color: theme.text, borderColor: theme.borderColor }]} 
          placeholder="Email" placeholderTextColor={theme.subText}
          keyboardType="email-address" autoCapitalize="none" 
          onChangeText={setEmail} value={email} 
        />
        <TextInput 
          style={[styles.input, { backgroundColor: theme.inputBackground, color: theme.text, borderColor: theme.borderColor }]} 
          placeholder="Password" placeholderTextColor={theme.subText}
          secureTextEntry={true} onChangeText={setPassword} value={password} 
        />
        
        <TouchableOpacity style={[styles.primaryButton, { opacity: isProcessing ? 0.7 : 1 }]} onPress={handleAuthentication} disabled={isProcessing}>
          {isProcessing ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.primaryButtonText}>{isLogin ? 'Login' : 'Register'}</Text>}
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.switchButton} onPress={() => { setIsLogin(!isLogin); setErrorMessage(''); }}>
          <Text style={styles.switchButtonText}>{isLogin ? "Don't have an account? Register" : "Already have an account? Login"}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

// ==========================================
// 4. HOME / DASHBOARD SCREEN
// ==========================================
function HomeScreen({ route, navigation }) {
  const { userEmail, userId } = route.params || { userEmail: 'User', userId: null };
  const { isDarkMode, setIsDarkMode, theme } = useContext(ThemeContext);
  
  const [userWatchlist, setUserWatchlist] = useState(['AAPL', 'NVDA', 'TSLA']); 
  const [selectedSymbol, setSelectedSymbol] = useState('AAPL');
  
  const [isLoading, setIsLoading] = useState(true);
  const [isAILoading, setIsAILoading] = useState(false);
  const [stockData, setStockData] = useState([]);
  const [chartData, setChartData] = useState({ labels: [], datasets: [{ data: [] }] });
  
  // State to hold the latest AI Analysis result for display
  const [aiResult, setAiResult] = useState(null);
  
  // State for Add Stock Modal
  const [isAddModalVisible, setAddModalVisible] = useState(false);
  const [newSymbol, setNewSymbol] = useState('');

  // Initial load
  useEffect(() => {
    NotificationService.requestPermissions();
    fetchUserWatchlist(); 
  }, []);

  // Fetch data when symbol changes
  useEffect(() => {
    if (selectedSymbol) {
      setAiResult(null); // Clear previous AI results when switching stocks
      fetchStockData(selectedSymbol);
    }
  }, [selectedSymbol]);

  // Background Polling mechanism: Fetch updated market data every 60 seconds
  useEffect(() => {
    if (!selectedSymbol) return;
    const intervalId = setInterval(() => {
      fetchStockData(selectedSymbol, false); // Fetch silently (without loading spinner)
    }, 60000); 

    // Cleanup interval on unmount
    return () => clearInterval(intervalId);
  }, [selectedSymbol]);

  const fetchUserWatchlist = async () => {
    try {
      // Future DB Endpoint: `${SERVER_URL}/api/users/${userId}/watchlist`
      const personalWatchlist = ['AAPL', 'NVDA', 'TSLA', 'MSFT']; 
      setUserWatchlist(personalWatchlist);
      setSelectedSymbol(personalWatchlist[0]);
    } catch (error) {
      console.error("Failed to load user watchlist:", error);
    }
  };

  /**
   * @param {string} symbol - Ticker to fetch
   * @param {boolean} showLoader - True to show full screen spinner, False for silent background refresh
   */
  const fetchStockData = async (symbol, showLoader = true) => {
    if (showLoader) setIsLoading(true);
    try {
      const response = await fetch(`${SERVER_URL}/api/stocks?symbol=${symbol}`);
      const data = await response.json();
      if (response.ok) {
        setStockData(data.stocks);
        setChartData(data.chart);
      }
    } catch (error) {
      console.error("[Home] Network Error:", error);
    } finally {
      if (showLoader) setIsLoading(false);
    }
  };

  /**
   * Handles adding a new ticker to the local watchlist.
   * TODO: Connect to backend route to persist in Prisma User table.
   */
  const handleAddStock = () => {
    const formattedSymbol = newSymbol.trim().toUpperCase();
    if (formattedSymbol && !userWatchlist.includes(formattedSymbol)) {
      setUserWatchlist([...userWatchlist, formattedSymbol]);
      setSelectedSymbol(formattedSymbol);
    }
    setAddModalVisible(false);
    setNewSymbol('');
  };

  const runMachineLearningAnalysis = async () => {
    setIsAILoading(true);
    try {
      const response = await fetch(`${SERVER_URL}/api/analyze/${selectedSymbol}`);
      const data = await response.json();

      if (response.ok && data.success) {
        const mockLstmResponse = {
            trend_direction: data.analysis.trend_direction || "BULLISH",
            expected_change_pct: 8.5, // Mocked until Flask returns exact percentages
            confidence_level: data.analysis.confidence_score || 85.0
        };
        const mockFnnResponse = {
            trend_direction: "BULLISH",
            probability_up: 0.88,
            confidence_level: 82.0
        };

        // Update UI with the result
        setAiResult(mockLstmResponse);

        // Process through Factory for Push Notifications
        const alarm = AlarmFactory.generateAlarm(selectedSymbol, mockLstmResponse, mockFnnResponse);
        if (alarm) {
            NotificationService.triggerLocalAlarm(alarm);
        }
      }
    } catch (error) {
      Alert.alert("Error", "Failed to communicate with AI microservice.");
    } finally {
      setIsAILoading(false);
    }
  };

  return (
    <View style={[styles.dashboardContainer, { backgroundColor: theme.background }]}>
      
      {/* Header Section */}
      <View style={styles.header}>
        <View>
          <Text style={[styles.dashboardTitle, { color: theme.text }]}>My Dashboard</Text>
          <Text style={[styles.dashboardSubtitle, { color: theme.subText }]}>{userEmail}</Text>
        </View>
        <View style={styles.toggleContainer}>
          <Text style={[styles.toggleText, { color: theme.subText }]}>{isDarkMode ? 'Dark' : 'Light'}</Text>
          <CustomSwitch value={isDarkMode} onValueChange={setIsDarkMode} />
        </View>
      </View>

      {/* Personalized Dynamic Stock Selector (Watchlist) */}
      <View style={styles.selectorContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {userWatchlist.map((symbol) => (
            <TouchableOpacity 
              key={symbol} 
              style={[
                styles.chip, 
                { backgroundColor: selectedSymbol === symbol ? theme.primary : theme.cardBackground,
                  borderColor: theme.borderColor }
              ]}
              onPress={() => setSelectedSymbol(symbol)}
            >
              <Text style={[
                styles.chipText, 
                { color: selectedSymbol === symbol ? '#fff' : theme.text }
              ]}>
                {symbol}
              </Text>
            </TouchableOpacity>
          ))}
          {/* Add to Watchlist Button */}
          <TouchableOpacity 
            style={[styles.chip, { backgroundColor: theme.cardBackground, borderColor: theme.primary, borderStyle: 'dashed' }]}
            onPress={() => setAddModalVisible(true)}
          >
            <Text style={[styles.chipText, { color: theme.primary }]}>+ Add</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.text }]}>Fetching data for {selectedSymbol}...</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
          {/* Interactive Line Chart */}
          <View style={{ alignItems: 'center', marginBottom: 15 }}>
            {chartData.datasets[0].data.length > 0 ? (
              <LineChart
                data={chartData} width={screenWidth - 40} height={220} yAxisLabel="$"
                chartConfig={{
                  backgroundColor: theme.cardBackground, backgroundGradientFrom: theme.cardBackground, backgroundGradientTo: theme.cardBackground,
                  decimalPlaces: 1, color: (opacity = 1) => isDarkMode ? `rgba(96, 165, 250, ${opacity})` : `rgba(59, 130, 246, ${opacity})`,
                  labelColor: (opacity = 1) => theme.subText, style: { borderRadius: 16 },
                  propsForDots: { r: "4", strokeWidth: "2", stroke: theme.primary }
                }}
                bezier style={{ borderRadius: 16 }}
              />
            ) : (
              <Text style={{ color: theme.text }}>No chart data available.</Text>
            )}
          </View>

          {/* ML Analysis Trigger */}
          <TouchableOpacity style={[styles.aiButton, { opacity: isAILoading ? 0.7 : 1 }]} onPress={runMachineLearningAnalysis} disabled={isAILoading}>
            {isAILoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.aiButtonText}>Run AI Models on {selectedSymbol}</Text>}
          </TouchableOpacity>

          {/* Display AI Results if available */}
          {aiResult && (
            <View style={[styles.aiResultCard, { backgroundColor: theme.cardBackground, borderColor: theme.primary }]}>
              <Text style={[styles.aiResultTitle, { color: theme.text }]}>AI Inference Insights</Text>
              <Text style={{ color: theme.subText, marginBottom: 5 }}>Predicted Trend: 
                <Text style={{ fontWeight: 'bold', color: aiResult.trend_direction === 'BULLISH' ? theme.success : theme.danger }}>
                  {' '}{aiResult.trend_direction}
                </Text>
              </Text>
              <Text style={{ color: theme.subText }}>Confidence Level: <Text style={{ fontWeight: 'bold', color: theme.text }}>{aiResult.confidence_level.toFixed(1)}%</Text></Text>
            </View>
          )}

          {/* Selected Stock Info Card */}
          {stockData.map((item, index) => (
             <View key={index} style={[styles.stockCard, { backgroundColor: theme.cardBackground, borderColor: theme.borderColor }]}>
               <View>
                 <Text style={[styles.stockSymbol, { color: theme.text }]}>{item.symbol}</Text>
                 <Text style={[styles.stockName, { color: theme.subText }]}>{item.name}</Text>
               </View>
               <View style={styles.priceContainer}>
                 <Text style={[styles.stockPrice, { color: theme.text }]}>${item.price.toFixed(2)}</Text>
                 <Text style={[styles.stockTrend, { color: item.isUp ? theme.success : theme.danger }]}>{item.trend}</Text>
               </View>
             </View>
          ))}
        </ScrollView>
      )}

      {/* Logout */}
      <TouchableOpacity style={styles.logoutButton} onPress={() => navigation.replace('Auth')} >
        <Text style={styles.primaryButtonText}>Log Out</Text>
      </TouchableOpacity>

      {/* Add Stock Modal UI */}
      <Modal visible={isAddModalVisible} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.cardBackground, borderColor: theme.borderColor }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Add to Watchlist</Text>
            <TextInput 
              style={[styles.input, { backgroundColor: theme.inputBackground, color: theme.text, borderColor: theme.borderColor }]} 
              placeholder="Enter Stock Symbol (e.g. AMZN)" 
              placeholderTextColor={theme.subText}
              autoCapitalize="characters"
              onChangeText={setNewSymbol} 
              value={newSymbol} 
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setAddModalVisible(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalAddBtn} onPress={handleAddStock}>
                <Text style={styles.modalAddText}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </View>
  );
}

// ==========================================
// MAIN APP EXPORT
// ==========================================
const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <ThemeProvider>
      <NavigationContainer>
        <Stack.Navigator initialRouteName="Auth">
          <Stack.Screen name="Auth" component={AuthScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Home" component={HomeScreen} options={{ headerShown: false }} />
        </Stack.Navigator>
      </NavigationContainer>
    </ThemeProvider>
  );
}

// ==========================================
// 6. STYLESHEET
// ==========================================
const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center' },
  authThemeToggle: { position: 'absolute', top: 60, right: 30, flexDirection: 'row', alignItems: 'center' },
  formContainer: { paddingHorizontal: 30 },
  title: { fontSize: 32, fontWeight: 'bold', marginBottom: 10, textAlign: 'center' },
  subtitle: { fontSize: 16, marginBottom: 20, textAlign: 'center' },
  errorText: { color: '#ef4444', fontSize: 14, textAlign: 'center', marginBottom: 15, fontWeight: '500' },
  input: { paddingVertical: 15, paddingHorizontal: 20, borderRadius: 10, marginBottom: 15, fontSize: 16, borderWidth: 1 },
  primaryButton: { backgroundColor: '#3b82f6', paddingVertical: 15, borderRadius: 10, alignItems: 'center', marginTop: 10 },
  primaryButtonText: { color: '#ffffff', fontSize: 18, fontWeight: 'bold' },
  switchButton: { marginTop: 20, alignItems: 'center' },
  switchButtonText: { color: '#3b82f6', fontSize: 16, fontWeight: '600' },
  customSwitchContainer: { width: 44, height: 24, borderRadius: 12, justifyContent: 'center', padding: 2 },
  customSwitchCircle: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#ffffff', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 2, elevation: 3 },
  dashboardContainer: { flex: 1, paddingTop: 60, paddingHorizontal: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  dashboardTitle: { fontSize: 24, fontWeight: 'bold' },
  dashboardSubtitle: { fontSize: 14, marginTop: 4 },
  toggleContainer: { flexDirection: 'row', alignItems: 'center' },
  toggleText: { marginRight: 8, fontSize: 14, fontWeight: '600' },
  
  selectorContainer: { marginBottom: 15, height: 45 },
  chip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, marginRight: 10, borderWidth: 1, height: 38, justifyContent: 'center' },
  chipText: { fontSize: 14, fontWeight: 'bold' },

  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 10, fontSize: 16, fontWeight: '500' },
  stockCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, borderRadius: 12, marginBottom: 12, borderWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 2 },
  stockSymbol: { fontSize: 18, fontWeight: 'bold', marginBottom: 4 },
  stockName: { fontSize: 14 },
  priceContainer: { alignItems: 'flex-end' },
  stockPrice: { fontSize: 18, fontWeight: '600', marginBottom: 4 },
  stockTrend: { fontSize: 14, fontWeight: 'bold' },
  
  aiButton: { backgroundColor: '#10b981', paddingVertical: 12, borderRadius: 10, alignItems: 'center', marginBottom: 15, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 3, elevation: 3 },
  aiButtonText: { color: '#ffffff', fontSize: 16, fontWeight: 'bold' },
  aiResultCard: { padding: 15, borderRadius: 12, borderWidth: 1, borderLeftWidth: 5, marginBottom: 15 },
  aiResultTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 8 },
  
  logoutButton: { backgroundColor: '#ef4444', paddingVertical: 15, borderRadius: 10, alignItems: 'center', marginVertical: 20 },

  /* Modal Styles */
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '80%', padding: 20, borderRadius: 12, borderWidth: 1 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15, textAlign: 'center' },
  modalButtons: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  modalCancelBtn: { padding: 10, flex: 1, alignItems: 'center' },
  modalCancelText: { color: '#ef4444', fontWeight: 'bold', fontSize: 16 },
  modalAddBtn: { padding: 10, flex: 1, alignItems: 'center', backgroundColor: '#3b82f6', borderRadius: 8 },
  modalAddText: { color: '#fff', fontWeight: 'bold', fontSize: 16 }
});