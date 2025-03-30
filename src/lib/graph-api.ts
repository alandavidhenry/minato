// src/lib/graph-api.ts
import { Client } from '@microsoft/microsoft-graph-client'
import { TokenCredentialAuthenticationProvider } from '@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials'
import { ClientSecretCredential } from '@azure/identity'

export interface GraphUser {
  id: string
  displayName: string
  mail: string
  userPrincipalName: string
  accountEnabled: boolean
  appRoleAssignments?: any[]
  createdDateTime?: string
  jobTitle?: string
  department?: string
}

interface CreateUserOptions {
  displayName: string
  mailNickname: string
  userPrincipalName: string
  password: string
  accountEnabled?: boolean
  forceChangePasswordNextSignIn?: boolean
}

// Initialize the Microsoft Graph client
export function getGraphClient() {
  // Create credential using client ID, tenant ID, and client secret
  const credential = new ClientSecretCredential(
    process.env.AZURE_AD_TENANT_ID!,
    process.env.AZURE_AD_CLIENT_ID!,
    process.env.AZURE_AD_CLIENT_SECRET!
  )

  // Create an authentication provider using the credential
  const authProvider = new TokenCredentialAuthenticationProvider(credential, {
    scopes: ['https://graph.microsoft.com/.default']
  })

  // Initialize the Graph client
  const graphClient = Client.initWithMiddleware({
    authProvider: authProvider
  })

  return graphClient
}

// Get all users
export async function getUsers(): Promise<GraphUser[]> {
  try {
    const client = getGraphClient()

    const result = await client
      .api('/users')
      .select(
        'id,displayName,mail,userPrincipalName,accountEnabled,jobTitle,department,createdDateTime'
      )
      .get()

    return result.value
  } catch (error) {
    console.error('Error fetching users from Microsoft Graph:', error)
    throw error
  }
}

// Get a single user by ID
export async function getUser(userId: string): Promise<GraphUser> {
  try {
    const client = getGraphClient()

    const user = await client
      .api(`/users/${userId}`)
      .select(
        'id,displayName,mail,userPrincipalName,accountEnabled,jobTitle,department,createdDateTime'
      )
      .get()

    // Get user's app role assignments
    const appRoles = await client
      .api(`/users/${userId}/appRoleAssignments`)
      .get()

    user.appRoleAssignments = appRoles.value

    return user
  } catch (error) {
    console.error(`Error fetching user ${userId} from Microsoft Graph:`, error)
    throw error
  }
}

// Create a new user
export async function createUser(
  options: CreateUserOptions
): Promise<GraphUser> {
  try {
    const client = getGraphClient()

    // Format the user object according to Microsoft Graph requirements
    const user = {
      displayName: options.displayName,
      mailNickname: options.mailNickname,
      userPrincipalName: options.userPrincipalName,
      accountEnabled: options.accountEnabled ?? true,
      passwordProfile: {
        password: options.password,
        forceChangePasswordNextSignIn:
          options.forceChangePasswordNextSignIn ?? true
      }
    }

    const result = await client.api('/users').post(user)

    return result
  } catch (error) {
    console.error('Error creating user in Microsoft Graph:', error)
    throw error
  }
}

// Update a user
export async function updateUser(
  userId: string,
  updates: Partial<GraphUser>
): Promise<void> {
  try {
    const client = getGraphClient()

    // Only include specific fields that can be updated
    const updateData: Record<string, any> = {}

    if (updates.displayName) updateData.displayName = updates.displayName
    if (updates.jobTitle) updateData.jobTitle = updates.jobTitle
    if (updates.department) updateData.department = updates.department
    if (typeof updates.accountEnabled === 'boolean') {
      updateData.accountEnabled = updates.accountEnabled
    }

    await client.api(`/users/${userId}`).update(updateData)
  } catch (error) {
    console.error(`Error updating user ${userId} in Microsoft Graph:`, error)
    throw error
  }
}

// Delete a user
export async function deleteUser(userId: string): Promise<void> {
  try {
    const client = getGraphClient()

    await client.api(`/users/${userId}`).delete()
  } catch (error) {
    console.error(`Error deleting user ${userId} in Microsoft Graph:`, error)
    throw error
  }
}

// Assign app role to user
export async function assignAppRoleToUser(
  userId: string,
  appId: string,
  appRoleId: string
): Promise<void> {
  try {
    const client = getGraphClient()

    // Get the service principal for the app
    const servicePrincipal = await client
      .api(`/servicePrincipals?$filter=appId eq '${appId}'`)
      .get()

    if (!servicePrincipal.value || servicePrincipal.value.length === 0) {
      throw new Error(`Service principal not found for app ID ${appId}`)
    }

    const servicePrincipalId = servicePrincipal.value[0].id

    // Create app role assignment
    const appRoleAssignment = {
      principalId: userId,
      resourceId: servicePrincipalId,
      appRoleId: appRoleId
    }

    await client
      .api(`/users/${userId}/appRoleAssignments`)
      .post(appRoleAssignment)
  } catch (error) {
    console.error(`Error assigning app role to user ${userId}:`, error)
    throw error
  }
}

// Remove app role from user
export async function removeAppRoleFromUser(
  userId: string,
  appRoleAssignmentId: string
): Promise<void> {
  try {
    const client = getGraphClient()

    await client
      .api(`/users/${userId}/appRoleAssignments/${appRoleAssignmentId}`)
      .delete()
  } catch (error) {
    console.error(`Error removing app role from user ${userId}:`, error)
    throw error
  }
}

// Reset a user's password
export async function resetUserPassword(
  userId: string,
  newPassword: string,
  forceChange: boolean = true
): Promise<void> {
  try {
    const client = getGraphClient()

    const passwordProfile = {
      passwordProfile: {
        password: newPassword,
        forceChangePasswordNextSignIn: forceChange
      }
    }

    await client.api(`/users/${userId}`).update(passwordProfile)
  } catch (error) {
    console.error(`Error resetting password for user ${userId}:`, error)
    throw error
  }
}
