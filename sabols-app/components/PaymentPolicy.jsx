import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  Pressable,
  SafeAreaView,
} from 'react-native';
import {
  ShieldCheck,
  CreditCard,
  Info,
  RefreshCcw,
  Truck,
  Ban,
  X,
} from 'lucide-react-native';

function Section({ icon: Icon, title, children }) {
  return (
    <View style={{ marginBottom: 20 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
        {Icon && <Icon size={16} color="#0ea5e9" style={{ marginRight: 6 }} />}
        <Text style={{ fontSize: 14, fontWeight: '700', color: '#111827' }}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

function Para({ children, style }) {
  return (
    <Text style={[{ fontSize: 13, color: '#6b7280', lineHeight: 20, marginBottom: 6 }, style]}>
      {children}
    </Text>
  );
}

export default function PaymentPolicy() {
  const [visible, setVisible] = useState(false);

  return (
    <>
      <TouchableOpacity onPress={() => setVisible(true)}>
        <Text style={{ color: '#0ea5e9', fontWeight: '600', fontSize: 12 }}>
          Terms &amp; Conditions
        </Text>
      </TouchableOpacity>

      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setVisible(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
          {/* Header */}
          <View style={{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
            paddingHorizontal: 20, paddingTop: 20, paddingBottom: 14,
            borderBottomWidth: 1, borderColor: '#e5e7eb',
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <ShieldCheck size={22} color="#0ea5e9" style={{ marginRight: 8 }} />
              <Text style={{ fontSize: 18, fontWeight: '800', color: '#111827' }}>
                Terms &amp; Conditions
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => setVisible(false)}
              style={{
                width: 32, height: 32, borderRadius: 16,
                backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <X size={18} color="#374151" />
            </TouchableOpacity>
          </View>

          {/* Content */}
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 20 }}
            showsVerticalScrollIndicator={false}
          >
            <Section icon={CreditCard} title="Accepted Payment Methods">
              <Para>
                Customers can pay online via UPI using apps like Google Pay, PhonePe, or Paytm.
                Online payments are processed through our payment partner{' '}
                <Text style={{ fontWeight: '700', color: '#111827' }}>Razorpay</Text>{' '}
                (for payment confirmation and receipts).
              </Para>
            </Section>

            <Section icon={ShieldCheck} title="Order Confirmation Rule">
              <Para>
                An order is treated as confirmed only when payment is marked{' '}
                <Text style={{ fontWeight: '700', color: '#16a34a' }}>"Paid/Success"</Text>{' '}
                in your order status. If payment is not confirmed, the order remains "Payment Pending"
                and may not be dispatched until confirmed (or switched to COD if enabled).
              </Para>
            </Section>

            <Section icon={Info} title="Payment Failures / Pending Payments">
              <Para>
                If a UPI payment fails or is stuck processing, your order will show{' '}
                <Text style={{ fontWeight: '700', color: '#dc2626' }}>Payment Failed</Text>{' '}
                or{' '}
                <Text style={{ fontWeight: '700', color: '#ca8a04' }}>Processing</Text>.
                Please wait a few minutes and use "Check Status" before trying again. Avoid paying twice.
              </Para>
              <Para style={{
                backgroundColor: '#f9fafb', padding: 10, borderRadius: 8, fontStyle: 'italic',
              }}>
                Duplicate payments: If you accidentally pay twice, we will either refund the extra
                amount or adjust it as credit in your next order. Keep your transaction reference/UTR
                for faster help.
              </Para>
            </Section>

            <Section icon={Truck} title="Cash on Delivery (COD) Policy">
              <Para>
                COD may be available for select areas/customers. For repeated non-availability or
                cancellations, we may require prepaid orders only for future deliveries.
              </Para>
            </Section>

            <View style={{
              marginBottom: 20,
              borderLeftWidth: 3, borderColor: '#bae6fd',
              paddingLeft: 14, paddingVertical: 6,
            }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#111827', marginBottom: 6 }}>
                Security Deposit for Cans
              </Text>
              <Para>A refundable can deposit is recorded in your account. Deposit is refundable when:</Para>
              <Para>• All cans are returned in acceptable condition.</Para>
              <Para>• All dues are cleared.</Para>
              <Para>Damaged or lost cans may be adjusted against the deposit.</Para>
            </View>

            <Section icon={Ban} title="Cancellations">
              <Para>
                <Text style={{ fontWeight: '700', color: '#111827' }}>Prepaid orders: </Text>
                Cancellation is allowed only{' '}
                <Text style={{ fontWeight: '800', color: '#111827' }}>before 11:00 AM </Text>
                on the day of delivery (or before route assignment).
              </Para>
              <Para>
                <Text style={{ fontWeight: '700', color: '#111827' }}>After dispatch: </Text>
                Cancellation may not be possible; if approved, delivery charges (if any) may be deducted.
              </Para>
            </Section>

            <Section title="Receipts, Billing &amp; Disputes">
              <Para>
                A digital receipt/status is available in your order history. If you face a dispute
                ("debited but not updated"), contact support with your{' '}
                <Text style={{ fontWeight: '700', color: '#111827' }}>Order ID + UTR/transaction reference</Text>.
              </Para>
            </Section>

            <View style={{ height: 20 }} />
          </ScrollView>

          {/* Footer */}
          <View style={{ padding: 16, borderTopWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#f9fafb' }}>
            <TouchableOpacity
              onPress={() => setVisible(false)}
              style={{
                backgroundColor: '#0ea5e9', paddingVertical: 14,
                borderRadius: 12, alignItems: 'center',
              }}
            >
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Close</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    </>
  );
}
