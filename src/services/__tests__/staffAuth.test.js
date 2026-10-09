import { observeStaffSession, signInStaff } from "../staffAuth";
import {
  getIdTokenResult,
  onIdTokenChanged,
  signInWithEmailAndPassword,
  setPersistence,
} from "firebase/auth";
import { Platform } from "react-native";
jest.mock("firebase/auth", () => ({
  getAuth: () => ({}),
  onIdTokenChanged: jest.fn(),
  getIdTokenResult: jest.fn(),
  signInWithEmailAndPassword: jest.fn(),
  signOut: jest.fn(),
  setPersistence: jest.fn(async () => {}),
  browserSessionPersistence: "session",
}));
beforeEach(() => jest.clearAllMocks());
test("claims are required and an outdated token callback cannot restore a signed-out session", async () => {
  let callback, resolve;
  const unsubscribe = jest.fn();
  onIdTokenChanged.mockImplementation((auth, listener) => {
    callback = listener;
    return unsubscribe;
  });
  const listener = jest.fn();
  const stop = observeStaffSession(listener);
  getIdTokenResult.mockReturnValue(
    new Promise((done) => {
      resolve = done;
    })
  );
  const pending = callback({ uid: "staff-test" });
  await callback(null);
  resolve({ claims: { role: "staff", restaurantId: "rest-test" } });
  await pending;
  expect(listener).toHaveBeenCalledTimes(1);
  expect(listener).toHaveBeenLastCalledWith({
    loading: false,
    user: null,
    restaurantId: null,
  });
  stop();
  expect(unsubscribe).toHaveBeenCalled();
});
test.each([
  { role: "customer", restaurantId: "rest-test" },
  { role: "staff", restaurantId: "../other" },
])("invalid claims do not expose a restaurant session", async (claims) => {
  let callback;
  onIdTokenChanged.mockImplementation((auth, listener) => {
    callback = listener;
    return jest.fn();
  });
  getIdTokenResult.mockResolvedValue({ claims });
  const listener = jest.fn();
  observeStaffSession(listener);
  await callback({ uid: "user" });
  expect(listener).toHaveBeenCalledWith(
    expect.objectContaining({ restaurantId: null, error: expect.any(String) })
  );
});
test("Web staff login uses session persistence", async () => {
  const old = Platform.OS;
  Platform.OS = "web";
  try {
    await signInStaff(" staff@example.invalid ", "synthetic-password");
    expect(setPersistence).toHaveBeenCalledWith({}, "session");
    expect(signInWithEmailAndPassword).toHaveBeenCalledWith(
      {},
      "staff@example.invalid",
      "synthetic-password"
    );
  } finally {
    Platform.OS = old;
  }
});
