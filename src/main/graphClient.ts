import { Client } from '@microsoft/microsoft-graph-client';
import { AuthManager } from './auth';

interface GraphEmailAddress {
  emailAddress: {
    name: string;
    address: string;
  };
}

interface GraphMessage {
  id: string;
  subject: string;
  bodyPreview: string;
  body: { contentType: string; content: string };
  from: GraphEmailAddress;
  toRecipients: GraphEmailAddress[];
  ccRecipients: GraphEmailAddress[];
  receivedDateTime: string;
  isRead: boolean;
  flag: { flagStatus: string };
  hasAttachments: boolean;
  importance: string;
  parentFolderId: string;
}

interface GraphMailFolder {
  id: string;
  displayName: string;
  parentFolderId: string;
  childFolderCount: number;
  unreadItemCount: number;
  totalItemCount: number;
}

interface GraphUser {
  displayName: string;
  mail: string;
  userPrincipalName: string;
  jobTitle: string;
}

interface GraphPagedResponse<T> {
  value: T[];
  '@odata.nextLink'?: string;
  '@odata.count'?: number;
}

export class GraphMailClient {
  private client: Client;

  constructor(authManager: AuthManager) {
    this.client = Client.init({
      authProvider: async (done) => {
        try {
          const token = await authManager.getAccessToken();
          done(null, token);
        } catch (error) {
          done(error as Error, null);
        }
      },
    });
  }

  async getProfile(): Promise<GraphUser> {
    return await this.client.api('/me').get();
  }

  async getMailFolders(): Promise<GraphMailFolder[]> {
    const response: GraphPagedResponse<GraphMailFolder> = await this.client
      .api('/me/mailFolders')
      .top(50)
      .select('id,displayName,parentFolderId,childFolderCount,unreadItemCount,totalItemCount')
      .get();

    return response.value;
  }

  async getMessages(
    folderId: string,
    page: number = 0,
    pageSize: number = 25
  ): Promise<{ messages: GraphMessage[]; totalCount: number }> {
    const skip = page * pageSize;

    const response: GraphPagedResponse<GraphMessage> = await this.client
      .api(`/me/mailFolders/${folderId}/messages`)
      .top(pageSize)
      .skip(skip)
      .orderby('receivedDateTime desc')
      .select(
        'id,subject,bodyPreview,from,toRecipients,ccRecipients,receivedDateTime,isRead,flag,hasAttachments,importance,parentFolderId'
      )
      .header('Prefer', 'outlook.body-content-type="html"')
      .get();

    return {
      messages: response.value,
      totalCount: response['@odata.count'] ?? response.value.length,
    };
  }

  async getMessage(messageId: string): Promise<GraphMessage> {
    return await this.client
      .api(`/me/messages/${messageId}`)
      .select(
        'id,subject,bodyPreview,body,from,toRecipients,ccRecipients,receivedDateTime,isRead,flag,hasAttachments,importance,parentFolderId'
      )
      .header('Prefer', 'outlook.body-content-type="html"')
      .get();
  }

  async sendMessage(messageData: {
    to: string[];
    cc?: string[];
    bcc?: string[];
    subject: string;
    body: string;
    isHtml: boolean;
  }): Promise<void> {
    const message = {
      subject: messageData.subject,
      body: {
        contentType: messageData.isHtml ? 'HTML' : 'Text',
        content: messageData.body,
      },
      toRecipients: messageData.to.map((email) => ({
        emailAddress: { address: email },
      })),
      ccRecipients: (messageData.cc ?? []).map((email) => ({
        emailAddress: { address: email },
      })),
      bccRecipients: (messageData.bcc ?? []).map((email) => ({
        emailAddress: { address: email },
      })),
    };

    await this.client.api('/me/sendMail').post({ message, saveToSentItems: true });
  }

  async replyToMessage(messageId: string, comment: string, isHtml: boolean): Promise<void> {
    await this.client.api(`/me/messages/${messageId}/reply`).post({
      comment,
      message: {
        body: {
          contentType: isHtml ? 'HTML' : 'Text',
          content: comment,
        },
      },
    });
  }

  async moveMessage(messageId: string, destinationFolderId: string): Promise<void> {
    await this.client.api(`/me/messages/${messageId}/move`).post({
      destinationId: destinationFolderId,
    });
  }

  async deleteMessage(messageId: string): Promise<void> {
    await this.client.api(`/me/messages/${messageId}`).delete();
  }

  async markAsRead(messageId: string, isRead: boolean): Promise<void> {
    await this.client.api(`/me/messages/${messageId}`).patch({ isRead });
  }

  async toggleFlag(messageId: string, isFlagged: boolean): Promise<void> {
    await this.client.api(`/me/messages/${messageId}`).patch({
      flag: { flagStatus: isFlagged ? 'flagged' : 'notFlagged' },
    });
  }

  async searchMessages(query: string): Promise<GraphMessage[]> {
    const response: GraphPagedResponse<GraphMessage> = await this.client
      .api('/me/messages')
      .search(`"${query}"`)
      .top(50)
      .select(
        'id,subject,bodyPreview,from,toRecipients,receivedDateTime,isRead,flag,hasAttachments,importance,parentFolderId'
      )
      .get();

    return response.value;
  }

  async saveDraft(messageData: {
    to: string[];
    cc?: string[];
    subject: string;
    body: string;
    isHtml: boolean;
  }): Promise<GraphMessage> {
    const message = {
      subject: messageData.subject,
      body: {
        contentType: messageData.isHtml ? 'HTML' : 'Text',
        content: messageData.body,
      },
      toRecipients: messageData.to.map((email) => ({
        emailAddress: { address: email },
      })),
      ccRecipients: (messageData.cc ?? []).map((email) => ({
        emailAddress: { address: email },
      })),
    };

    return await this.client.api('/me/messages').post(message);
  }
}
