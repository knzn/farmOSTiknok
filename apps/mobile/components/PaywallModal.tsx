import { Modal, View, Text, TouchableOpacity, ScrollView, Linking } from 'react-native'
import { usePaywallStore } from '../stores/paywall'

const GCASH_NUMBER = '0919-098-9322'

const PLANS = [
  {
    label: 'Monthly',
    price: '₱50',
    period: 'per month',
    detail: '₱50 GCash · renews monthly',
    highlight: false,
  },
  {
    label: 'Annual',
    price: '₱499',
    period: 'per year',
    detail: 'Save ₱101 vs monthly · best value',
    highlight: true,
  },
]

export function PaywallModal() {
  const { visible, reason, hide } = usePaywallStore()

  if (!visible) return null

  const isSuspended = reason === 'suspended'

  function openGCash() {
    Linking.openURL(`gcash://send?number=${GCASH_NUMBER.replace(/-/g, '')}`)
      .catch(() => {
        // GCash not installed — open Facebook page or messenger as fallback
      })
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={hide}
    >
      <View style={{
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.75)',
        justifyContent: 'flex-end',
      }}>
        <View style={{
          backgroundColor: '#0F0F0F',
          borderTopLeftRadius: 24, borderTopRightRadius: 24,
          borderTopWidth: 1, borderTopColor: '#2A2A2A',
          maxHeight: '92%',
        }}>
          {/* Drag handle */}
          <View style={{ alignItems: 'center', paddingTop: 10, paddingBottom: 4 }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: '#3A3A3A' }} />
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ padding: 24, paddingBottom: 40 }}
          >
            {/* Icon + heading */}
            <View style={{ alignItems: 'center', marginBottom: 20 }}>
              <Text style={{ fontSize: 48, marginBottom: 12 }}>{isSuspended ? '🔒' : '⏰'}</Text>
              <Text style={{ color: '#FFFFFF', fontSize: 22, fontWeight: '800', textAlign: 'center', marginBottom: 8 }}>
                {isSuspended ? 'Account Suspended' : 'Your Free Trial Has Ended'}
              </Text>
              <Text style={{ color: '#A0A0A0', fontSize: 14, textAlign: 'center', lineHeight: 22 }}>
                {isSuspended
                  ? 'Your account has been suspended. Message us on Facebook or Messenger to resolve this.'
                  : 'You\'ve used your 60-day free trial. Subscribe to keep managing your farm on TIKNOK.'
                }
              </Text>
            </View>

            {!isSuspended && (
              <>
                {/* Plan cards */}
                <View style={{ flexDirection: 'row', gap: 10, marginBottom: 24 }}>
                  {PLANS.map((plan) => (
                    <View
                      key={plan.label}
                      style={{
                        flex: 1,
                        backgroundColor: plan.highlight ? '#C8A84B18' : '#141414',
                        borderRadius: 16,
                        borderWidth: 1.5,
                        borderColor: plan.highlight ? '#C8A84B' : '#2A2A2A',
                        padding: 16,
                        alignItems: 'center',
                      }}
                    >
                      {plan.highlight && (
                        <View style={{ backgroundColor: '#C8A84B', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, marginBottom: 10 }}>
                          <Text style={{ color: '#0A0A0A', fontSize: 9, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 }}>
                            Best Value
                          </Text>
                        </View>
                      )}
                      <Text style={{ color: plan.highlight ? '#C8A84B' : '#FFFFFF', fontSize: 28, fontWeight: '800' }}>
                        {plan.price}
                      </Text>
                      <Text style={{ color: '#606060', fontSize: 11, marginBottom: 8 }}>{plan.period}</Text>
                      <Text style={{ color: '#A0A0A0', fontSize: 11, textAlign: 'center', lineHeight: 16 }}>
                        {plan.detail}
                      </Text>
                    </View>
                  ))}
                </View>

                {/* How to pay */}
                <View style={{
                  backgroundColor: '#141414', borderRadius: 14,
                  borderWidth: 1, borderColor: '#2A2A2A',
                  padding: 16, marginBottom: 20,
                }}>
                  <Text style={{ color: '#606060', fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
                    How to Subscribe
                  </Text>
                  {[
                    { step: '1', text: `Send payment via GCash to ${GCASH_NUMBER}` },
                    { step: '2', text: 'Screenshot your GCash receipt' },
                    { step: '3', text: 'Message us on Facebook or Messenger with the screenshot + your TK-ID' },
                    { step: '4', text: 'We\'ll activate your account within 24 hours' },
                  ].map((item) => (
                    <View key={item.step} style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
                      <View style={{
                        width: 22, height: 22, borderRadius: 11,
                        backgroundColor: '#C8A84B22', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0, marginTop: 1,
                      }}>
                        <Text style={{ color: '#C8A84B', fontSize: 11, fontWeight: '800' }}>{item.step}</Text>
                      </View>
                      <Text style={{ color: '#A0A0A0', fontSize: 13, lineHeight: 20, flex: 1 }}>{item.text}</Text>
                    </View>
                  ))}
                </View>

                {/* GCash CTA */}
                <TouchableOpacity
                  onPress={openGCash}
                  activeOpacity={0.85}
                  style={{
                    backgroundColor: '#0078FF',
                    borderRadius: 14, paddingVertical: 15,
                    alignItems: 'center', marginBottom: 10,
                  }}
                >
                  <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '800' }}>Open GCash</Text>
                </TouchableOpacity>
              </>
            )}

            {/* Contact / support CTA */}
            <TouchableOpacity
              onPress={() => Linking.openURL('https://www.facebook.com/rdd.gf.bert.dacles').catch(() => {})}
              activeOpacity={0.8}
              style={{
                backgroundColor: '#1877F222',
                borderRadius: 14, paddingVertical: 14,
                alignItems: 'center', marginBottom: 16,
                borderWidth: 1, borderColor: '#1877F244',
              }}
            >
              <Text style={{ color: '#4E9AF1', fontSize: 14, fontWeight: '700' }}>
                💬  Message Us on Messenger
              </Text>
            </TouchableOpacity>

            {/* Dismiss */}
            <TouchableOpacity onPress={hide} activeOpacity={0.6} style={{ alignItems: 'center', paddingVertical: 8 }}>
              <Text style={{ color: '#606060', fontSize: 13 }}>
                {isSuspended ? 'Close' : 'Remind me later'}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  )
}
