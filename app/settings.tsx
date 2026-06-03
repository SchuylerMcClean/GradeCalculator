import { useAuth } from "@/lib/auth-context";
import { AppTextInput } from "@/components/app-text-input";
import {
  getUserProfile,
  updateUsername,
  deleteUserData,
} from "@/lib/firestore";
import { useRouter } from "expo-router";
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
  updateProfile,
  deleteUser,
} from "firebase/auth";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const COLORS = {
  bg: "#020617",
  card: "rgba(255, 255, 255, 0.05)",
  border: "rgba(255, 255, 255, 0.12)",
  accent: "#a78bfa",
  textMain: "#f8fafc",
  textDim: "#94a3b8",
  success: "#4ade80",
  danger: "#f87171",
};

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function SettingsScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [username, setUsername] = useState<string | null>(null);

  // Change username modal state
  const [unModalVisible, setUnModalVisible] = useState(false);

  // Delete account modal state
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const openDeleteModal = () => {
    setDeletePassword("");
    setDeleteError("");
    setDeleteModalVisible(true);
  };

  const handleDeleteAccount = async () => {
    if (!user || !user.email) return;
    if (!deletePassword) {
      setDeleteError("Please enter your password to confirm.");
      return;
    }
    setDeleteError("");
    setDeleteLoading(true);
    try {
      const credential = EmailAuthProvider.credential(
        user.email,
        deletePassword,
      );
      await reauthenticateWithCredential(user, credential);
      await deleteUserData(user.uid, username ?? "");
      await deleteUser(user);
      router.replace("/(auth)/login" as any);
    } catch (e: any) {
      const msg =
        e.code === "auth/wrong-password" || e.code === "auth/invalid-credential"
          ? "Incorrect password."
          : e.code === "auth/too-many-requests"
            ? "Too many attempts. Please wait and try again."
            : "Failed to delete account. Please try again.";
      setDeleteError(msg);
    } finally {
      setDeleteLoading(false);
    }
  };
  const [newUsername, setNewUsername] = useState("");
  const [unLoading, setUnLoading] = useState(false);
  const [unError, setUnError] = useState("");
  const [unSuccess, setUnSuccess] = useState(false);

  const openUnModal = () => {
    setNewUsername(username ?? "");
    setUnError("");
    setUnSuccess(false);
    setUnModalVisible(true);
  };

  const handleChangeUsername = async () => {
    if (!user || !user.email) return;
    const trimmed = newUsername.trim();
    if (!trimmed) {
      setUnError("Username cannot be empty.");
      return;
    }
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(trimmed)) {
      setUnError(
        "Username must be 3–20 characters and contain only letters, numbers, or underscores.",
      );
      return;
    }
    if (trimmed.toLowerCase() === username?.toLowerCase()) {
      setUnError("That is already your username.");
      return;
    }
    setUnError("");
    setUnLoading(true);
    try {
      const result = await updateUsername(
        user.uid,
        user.email,
        username ?? "",
        trimmed,
      );
      if (result === "taken") {
        setUnError("That username is already taken.");
      } else {
        setUsername(trimmed);
        setUnSuccess(true);
        setTimeout(() => setUnModalVisible(false), 1500);
      }
    } catch {
      setUnError("Failed to update username. Please try again.");
    } finally {
      setUnLoading(false);
    }
  };

  // Change name modal state
  const [nameModalVisible, setNameModalVisible] = useState(false);
  const [newName, setNewName] = useState("");
  const [nameLoading, setNameLoading] = useState(false);
  const [nameError, setNameError] = useState("");
  const [nameSuccess, setNameSuccess] = useState(false);

  const openNameModal = () => {
    setNewName(user?.displayName ?? "");
    setNameError("");
    setNameSuccess(false);
    setNameModalVisible(true);
  };

  const handleChangeName = async () => {
    if (!user) return;
    if (!newName.trim()) {
      setNameError("Name cannot be empty.");
      return;
    }
    setNameError("");
    setNameLoading(true);
    try {
      await updateProfile(user, { displayName: newName.trim() });
      setNameSuccess(true);
      setTimeout(() => setNameModalVisible(false), 1500);
    } catch {
      setNameError("Failed to update name. Please try again.");
    } finally {
      setNameLoading(false);
    }
  };

  // Change password modal state
  const [pwModalVisible, setPwModalVisible] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwLoading, setPwLoading] = useState(false);
  const [pwError, setPwError] = useState("");
  const [pwSuccess, setPwSuccess] = useState(false);

  const openPwModal = () => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setPwError("");
    setPwSuccess(false);
    setPwModalVisible(true);
  };

  const handleChangePassword = async () => {
    if (!user || !user.email) return;
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPwError("Please fill in all fields.");
      return;
    }
    if (newPassword.length < 6) {
      setPwError("New password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError("New passwords do not match.");
      return;
    }
    setPwError("");
    setPwLoading(true);
    try {
      const credential = EmailAuthProvider.credential(
        user.email,
        currentPassword,
      );
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);
      setPwSuccess(true);
      setTimeout(() => setPwModalVisible(false), 1500);
    } catch (e: any) {
      const msg =
        e.code === "auth/wrong-password" || e.code === "auth/invalid-credential"
          ? "Current password is incorrect."
          : e.code === "auth/too-many-requests"
            ? "Too many attempts. Please wait a few minutes and try again."
            : e.code === "auth/weak-password"
              ? "Password is too weak. Please choose a stronger password."
              : "Failed to change password. Please try again.";
      setPwError(msg);
    } finally {
      setPwLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    getUserProfile(user.uid).then((profile) => {
      setUsername(profile?.username ?? null);
    });
  }, [user]);

  if (!user) return null;

  return (
    <SafeAreaView style={styles.page}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.maxWidthContent}>
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => router.back()}
            >
              <Text style={styles.backBtnText}>← Back</Text>
            </TouchableOpacity>
            <Text style={styles.title}>Settings</Text>
          </View>

          {/* Account section */}
          <Text style={styles.sectionLabel}>ACCOUNT</Text>
          <View style={styles.card}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarInitial}>
                {(user.displayName ?? user.email ?? "?")[0].toUpperCase()}
              </Text>
            </View>
            <Text style={styles.displayName}>
              {user.displayName ?? "No display name"}
            </Text>
            <Text style={styles.emailSubtitle}>{user.email}</Text>
          </View>

          {/* Details section */}
          <Text style={styles.sectionLabel}>DETAILS</Text>
          <View style={styles.detailsCard}>
            <InfoRow label="Email" value={user.email ?? "—"} />
            <View style={styles.divider} />
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Name</Text>
              <View style={styles.passwordRowRight}>
                <Text style={styles.infoValue}>
                  {user.displayName ?? "Not set"}
                </Text>
                <TouchableOpacity
                  onPress={openNameModal}
                  style={styles.changeBtn}
                >
                  <Text style={styles.changeBtnText}>Change</Text>
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.divider} />
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Username</Text>
              <View style={styles.passwordRowRight}>
                <Text style={styles.infoValue}>{username ?? "—"}</Text>
                <TouchableOpacity
                  onPress={openUnModal}
                  style={styles.changeBtn}
                >
                  <Text style={styles.changeBtnText}>Change</Text>
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.divider} />
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Password</Text>
              <View style={styles.passwordRowRight}>
                <Text style={styles.infoValue}>{"●".repeat(10)}</Text>
                <TouchableOpacity
                  onPress={openPwModal}
                  style={styles.changeBtn}
                >
                  <Text style={styles.changeBtnText}>Change</Text>
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.divider} />
            <InfoRow
              label="Account Created"
              value={formatDate(user.metadata.creationTime)}
            />
            <View style={styles.divider} />
            <InfoRow
              label="Last Sign In"
              value={formatDate(user.metadata.lastSignInTime)}
            />
          </View>

          {/* Danger zone section */}
          <Text style={styles.sectionLabel}>DANGER ZONE</Text>
          <View style={styles.dangerCard}>
            <View style={styles.dangerRow}>
              <View style={styles.dangerTextGroup}>
                <Text style={styles.dangerTitle}>Delete Account</Text>
                <Text style={styles.dangerSubtitle}>
                  Permanently delete your account and all data. This cannot be
                  undone.
                </Text>
              </View>
              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={openDeleteModal}
              >
                <Text style={styles.deleteBtnText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Delete Account Modal */}
      <Modal
        visible={deleteModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDeleteModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalOverlay}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Delete Account</Text>
            <Text style={styles.dangerSubtitle}>
              This will permanently delete your account and all associated data.
              Enter your password to confirm.
            </Text>

            <Text style={[styles.modalLabel, { marginTop: 12 }]}>Password</Text>
            <AppTextInput
              style={styles.modalInput}
              placeholder="Your password"
              placeholderTextColor={COLORS.textDim}
              secureTextEntry
              value={deletePassword}
              onChangeText={setDeletePassword}
              autoCapitalize="none"
            />

            {deleteError ? (
              <Text style={styles.modalError}>{deleteError}</Text>
            ) : null}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setDeleteModalVisible(false)}
                disabled={deleteLoading}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmDeleteBtn}
                onPress={handleDeleteAccount}
                disabled={deleteLoading}
              >
                {deleteLoading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.confirmDeleteText}>Delete Account</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Change Username Modal */}
      <Modal
        visible={unModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setUnModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalOverlay}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Change Username</Text>

            <Text style={styles.modalLabel}>New Username</Text>
            <AppTextInput
              style={styles.modalInput}
              placeholder="Enter new username"
              placeholderTextColor={COLORS.textDim}
              value={newUsername}
              onChangeText={setNewUsername}
              autoCapitalize="none"
              autoCorrect={false}
            />

            {unError ? <Text style={styles.modalError}>{unError}</Text> : null}
            {unSuccess ? (
              <Text style={styles.modalSuccess}>Username updated!</Text>
            ) : null}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setUnModalVisible(false)}
                disabled={unLoading}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSaveBtn}
                onPress={handleChangeUsername}
                disabled={unLoading}
              >
                {unLoading ? (
                  <ActivityIndicator color="#020617" size="small" />
                ) : (
                  <Text style={styles.modalSaveText}>Update</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Change Name Modal */}
      <Modal
        visible={nameModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setNameModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalOverlay}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Change Name</Text>

            <Text style={styles.modalLabel}>New Name</Text>
            <AppTextInput
              style={styles.modalInput}
              placeholder="Enter your name"
              placeholderTextColor={COLORS.textDim}
              value={newName}
              onChangeText={setNewName}
              autoCapitalize="words"
            />

            {nameError ? (
              <Text style={styles.modalError}>{nameError}</Text>
            ) : null}
            {nameSuccess ? (
              <Text style={styles.modalSuccess}>Name updated!</Text>
            ) : null}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setNameModalVisible(false)}
                disabled={nameLoading}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSaveBtn}
                onPress={handleChangeName}
                disabled={nameLoading}
              >
                {nameLoading ? (
                  <ActivityIndicator color="#020617" size="small" />
                ) : (
                  <Text style={styles.modalSaveText}>Update</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Change Password Modal */}
      <Modal
        visible={pwModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPwModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalOverlay}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Change Password</Text>

            <Text style={styles.modalLabel}>Current Password</Text>
            <AppTextInput
              style={styles.modalInput}
              placeholder="Current password"
              placeholderTextColor={COLORS.textDim}
              secureTextEntry
              value={currentPassword}
              onChangeText={setCurrentPassword}
              autoCapitalize="none"
            />

            <Text style={styles.modalLabel}>New Password</Text>
            <AppTextInput
              style={styles.modalInput}
              placeholder="New password"
              placeholderTextColor={COLORS.textDim}
              secureTextEntry
              value={newPassword}
              onChangeText={setNewPassword}
              autoCapitalize="none"
            />

            <Text style={styles.modalLabel}>Confirm New Password</Text>
            <AppTextInput
              style={styles.modalInput}
              placeholder="Confirm new password"
              placeholderTextColor={COLORS.textDim}
              secureTextEntry
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              autoCapitalize="none"
            />

            {pwError ? <Text style={styles.modalError}>{pwError}</Text> : null}
            {pwSuccess ? (
              <Text style={styles.modalSuccess}>Password updated!</Text>
            ) : null}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setPwModalVisible(false)}
                disabled={pwLoading}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSaveBtn}
                onPress={handleChangePassword}
                disabled={pwLoading}
              >
                {pwLoading ? (
                  <ActivityIndicator color="#020617" size="small" />
                ) : (
                  <Text style={styles.modalSaveText}>Update</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  maxWidthContent: {
    maxWidth: 900,
    width: "100%",
    alignSelf: "center",
    paddingHorizontal: 24,
    paddingBottom: 48,
    gap: 8,
  },
  header: {
    paddingTop: 28,
    paddingBottom: 20,
    gap: 8,
  },
  backBtn: {
    alignSelf: "flex-start",
  },
  backBtnText: {
    color: COLORS.accent,
    fontSize: 14,
    fontWeight: "500",
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: COLORS.textMain,
  },
  scrollContent: {
    flexGrow: 1,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.textDim,
    letterSpacing: 1.2,
    marginTop: 16,
    marginBottom: 8,
    marginLeft: 4,
  },
  card: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    gap: 8,
  },
  avatarCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.accent,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  avatarInitial: {
    fontSize: 30,
    fontWeight: "700",
    color: "#020617",
  },
  displayName: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.textMain,
  },
  emailSubtitle: {
    fontSize: 14,
    color: COLORS.textDim,
  },
  detailsCard: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    overflow: "hidden",
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 16,
  },
  infoLabel: {
    fontSize: 14,
    color: COLORS.textDim,
    fontWeight: "500",
    flexShrink: 0,
  },
  infoValue: {
    fontSize: 14,
    color: COLORS.textMain,
    fontWeight: "400",
    textAlign: "right",
    flexShrink: 1,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginHorizontal: 20,
  },
  passwordRowRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flexShrink: 1,
  },
  changeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.accent,
  },
  changeBtnText: {
    color: COLORS.accent,
    fontSize: 13,
    fontWeight: "600",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalCard: {
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: 24,
    width: "100%",
    maxWidth: 440,
    gap: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.textMain,
    marginBottom: 8,
  },
  modalLabel: {
    fontSize: 13,
    color: COLORS.textDim,
    fontWeight: "500",
    marginTop: 4,
  },
  modalInput: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: COLORS.textMain,
  },
  modalError: {
    fontSize: 13,
    color: COLORS.danger,
    marginTop: 4,
  },
  modalSuccess: {
    fontSize: 13,
    color: COLORS.success,
    marginTop: 4,
  },
  modalActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 12,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
  },
  modalCancelText: {
    color: COLORS.textDim,
    fontWeight: "600",
    fontSize: 14,
  },
  modalSaveBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: COLORS.accent,
    alignItems: "center",
  },
  modalSaveText: {
    color: "#020617",
    fontWeight: "700",
    fontSize: 14,
  },
  dangerCard: {
    backgroundColor: "rgba(248, 113, 113, 0.07)",
    borderWidth: 1,
    borderColor: "rgba(248, 113, 113, 0.3)",
    borderRadius: 16,
    overflow: "hidden",
  },
  dangerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 16,
  },
  dangerTextGroup: {
    flex: 1,
    gap: 4,
  },
  dangerTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.danger,
  },
  dangerSubtitle: {
    fontSize: 13,
    color: COLORS.textDim,
    lineHeight: 18,
  },
  deleteBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.danger,
  },
  deleteBtnText: {
    color: COLORS.danger,
    fontSize: 13,
    fontWeight: "600",
  },
  confirmDeleteBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: COLORS.danger,
    alignItems: "center",
  },
  confirmDeleteText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
  },
});
