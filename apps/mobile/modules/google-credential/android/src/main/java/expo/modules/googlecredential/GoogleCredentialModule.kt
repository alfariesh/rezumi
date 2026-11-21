package expo.modules.googlecredential

import androidx.credentials.ClearCredentialStateRequest
import androidx.credentials.CredentialManager
import androidx.credentials.CustomCredential
import androidx.credentials.GetCredentialRequest
import androidx.credentials.exceptions.ClearCredentialException
import androidx.credentials.exceptions.GetCredentialCancellationException
import androidx.credentials.exceptions.GetCredentialException
import androidx.credentials.exceptions.NoCredentialException
import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential
import com.google.android.libraries.identity.googleid.GoogleIdTokenParsingException
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

private class NoActivityException : CodedException("ERR_NO_ACTIVITY", "No activity to show the account picker on.", null)

private class NoAccountException : CodedException("ERR_NO_ACCOUNT", "No Google account is available on this device.", null)

private class SignInFailedException(cause: Throwable?) :
  CodedException("ERR_SIGN_IN_FAILED", "Google sign-in failed.", cause)

// "Sign in with Google" through Credential Manager: the button flow (GetSignInWithGoogleOption) always shows the
// account picker. Returns the Google ID token for the server to verify (its audience is the web client id), or null
// when the person closed the picker. Only the token leaves this module; it is never logged.
class GoogleCredentialModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("GoogleCredential")

    AsyncFunction("signIn") Coroutine { webClientId: String, nonce: String? ->
      val activity = appContext.currentActivity ?: throw NoActivityException()
      val option = GetSignInWithGoogleOption.Builder(webClientId)
        .apply { if (nonce != null) setNonce(nonce) }
        .build()
      val request = GetCredentialRequest.Builder().addCredentialOption(option).build()
      try {
        val credential = CredentialManager.create(activity).getCredential(activity, request).credential
        if (credential !is CustomCredential ||
          credential.type != GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL
        ) {
          throw SignInFailedException(null)
        }
        mapOf("idToken" to GoogleIdTokenCredential.createFrom(credential.data).idToken)
      } catch (error: GetCredentialCancellationException) {
        null
      } catch (error: NoCredentialException) {
        throw NoAccountException()
      } catch (error: GetCredentialException) {
        throw SignInFailedException(error)
      } catch (error: GoogleIdTokenParsingException) {
        throw SignInFailedException(error)
      }
    }

    // After signing out, so the next sign-in shows the account picker instead of reusing the last account.
    AsyncFunction("signOut") Coroutine { ->
      val activity = appContext.currentActivity ?: return@Coroutine null
      try {
        CredentialManager.create(activity).clearCredentialState(ClearCredentialStateRequest())
      } catch (error: ClearCredentialException) {
        // Nothing to clear; sign-out goes on.
      }
      null
    }
  }
}
