"use client";

import { useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import Navbar from '@/components/layout/Navbar';

export default function TestEmailPage() {
    const [email, setEmail] = useState('');
    const [status, setStatus] = useState('');
    const [loading, setLoading] = useState(false);
    const supabase = createClientComponentClient();

    const testPasswordReset = async () => {
        if (!email) {
            setStatus('❌ Please enter an email address');
            return;
        }

        setLoading(true);
        setStatus('📧 Sending password reset email...');

        try {
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/auth/reset`,
            });

            if (error) {
                setStatus(`❌ Error: ${error.message}`);
            } else {
                setStatus(`✅ Password reset email sent to ${email}!\n\nCheck:\n• Inbox (1-2 minutes)\n• Spam/Junk folder\n• Brevo dashboard logs`);
            }
        } catch (err: any) {
            setStatus(`❌ Error: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    const testSignUp = async () => {
        if (!email) {
            setStatus('❌ Please enter an email address');
            return;
        }

        setLoading(true);
        setStatus('📧 Creating test account and sending verification email...');

        try {
            // Create a test account with random password
            const testPassword = Math.random().toString(36).slice(-12) + 'A1!';

            const { error } = await supabase.auth.signUp({
                email: email,
                password: testPassword,
                options: {
                    emailRedirectTo: `${window.location.origin}/auth`,
                }
            });

            if (error) {
                setStatus(`❌ Error: ${error.message}`);
            } else {
                setStatus(`✅ Verification email sent to ${email}!\n\nTest Password: ${testPassword}\n\nCheck:\n• Inbox (1-2 minutes)\n• Spam/Junk folder\n• Brevo dashboard logs\n\nNote: Delete this test account from Supabase dashboard after testing.`);
            }
        } catch (err: any) {
            setStatus(`❌ Error: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50">
            <Navbar />

            <div className="max-w-2xl mx-auto pt-24 px-4 pb-12">
                <div className="bg-white rounded-xl shadow-lg p-8">
                    <h1 className="text-3xl font-bold mb-2">Test Brevo SMTP</h1>
                    <p className="text-gray-600 mb-8">
                        Verify that your Brevo SMTP integration is working correctly
                    </p>

                    <div className="space-y-6">
                        {/* Email Input */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Your Email Address
                            </label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="your@email.com"
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
                            />
                            <p className="mt-2 text-sm text-gray-500">
                                Use a real email address you have access to
                            </p>
                        </div>

                        {/* Test Buttons */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <button
                                onClick={testPasswordReset}
                                disabled={loading || !email}
                                className="bg-blue-600 text-white py-3 px-6 rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium"
                            >
                                {loading ? '⏳ Sending...' : '📧 Test Password Reset'}
                            </button>

                            <button
                                onClick={testSignUp}
                                disabled={loading || !email}
                                className="bg-green-600 text-white py-3 px-6 rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium"
                            >
                                {loading ? '⏳ Sending...' : '✉️ Test Sign Up Email'}
                            </button>
                        </div>

                        {/* Status Message */}
                        {status && (
                            <div className={`p-4 rounded-lg whitespace-pre-line ${status.includes('✅')
                                    ? 'bg-green-50 text-green-800 border border-green-200'
                                    : status.includes('📧')
                                        ? 'bg-blue-50 text-blue-800 border border-blue-200'
                                        : 'bg-red-50 text-red-800 border border-red-200'
                                }`}>
                                <div className="font-medium">{status}</div>
                            </div>
                        )}

                        {/* Instructions */}
                        <div className="mt-8 space-y-4">
                            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                                <h3 className="font-semibold text-blue-900 mb-3">📋 What to Check:</h3>
                                <ul className="text-sm text-blue-800 space-y-2">
                                    <li className="flex items-start">
                                        <span className="mr-2">✓</span>
                                        <span><strong>Inbox</strong> - Email should arrive within 1-2 minutes</span>
                                    </li>
                                    <li className="flex items-start">
                                        <span className="mr-2">✓</span>
                                        <span><strong>Spam/Junk</strong> - Check here if not in inbox</span>
                                    </li>
                                    <li className="flex items-start">
                                        <span className="mr-2">✓</span>
                                        <span><strong>Brevo Dashboard</strong> - Logs → Transactional → Check delivery status</span>
                                    </li>
                                    <li className="flex items-start">
                                        <span className="mr-2">✓</span>
                                        <span><strong>Supabase Logs</strong> - Auth Logs → Check for SMTP errors</span>
                                    </li>
                                </ul>
                            </div>

                            <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                                <h3 className="font-semibold text-yellow-900 mb-3">⚠️ Common Issues:</h3>
                                <ul className="text-sm text-yellow-800 space-y-2">
                                    <li className="flex items-start">
                                        <span className="mr-2">•</span>
                                        <span><strong>Emails in Spam</strong> - Add SPF/DKIM records to your domain</span>
                                    </li>
                                    <li className="flex items-start">
                                        <span className="mr-2">•</span>
                                        <span><strong>No Email Received</strong> - Check Brevo SMTP credentials in Supabase</span>
                                    </li>
                                    <li className="flex items-start">
                                        <span className="mr-2">•</span>
                                        <span><strong>SMTP Errors</strong> - Verify SMTP key (not account password)</span>
                                    </li>
                                </ul>
                            </div>

                            <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                                <h3 className="font-semibold text-green-900 mb-3">✅ Success Indicators:</h3>
                                <ul className="text-sm text-green-800 space-y-2">
                                    <li className="flex items-start">
                                        <span className="mr-2">✓</span>
                                        <span>Email arrives in inbox within 1-2 minutes</span>
                                    </li>
                                    <li className="flex items-start">
                                        <span className="mr-2">✓</span>
                                        <span>Brevo dashboard shows "Delivered" status</span>
                                    </li>
                                    <li className="flex items-start">
                                        <span className="mr-2">✓</span>
                                        <span>Verification/reset link works correctly</span>
                                    </li>
                                    <li className="flex items-start">
                                        <span className="mr-2">✓</span>
                                        <span>No errors in Supabase auth logs</span>
                                    </li>
                                </ul>
                            </div>
                        </div>

                        {/* Quick Links */}
                        <div className="mt-6 pt-6 border-t border-gray-200">
                            <h3 className="font-semibold text-gray-900 mb-3">🔗 Quick Links:</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <a
                                    href="https://app.brevo.com/log"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                                >
                                    <span className="text-sm font-medium">Brevo Logs</span>
                                    <span className="text-gray-400">→</span>
                                </a>
                                <a
                                    href="https://supabase.com/dashboard"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                                >
                                    <span className="text-sm font-medium">Supabase Dashboard</span>
                                    <span className="text-gray-400">→</span>
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
