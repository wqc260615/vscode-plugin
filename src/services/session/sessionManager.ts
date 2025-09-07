import * as vscode from 'vscode';

export interface ChatMessage {
    id: string;
    content: string;
    isUser: boolean;
    timestamp: Date;
}

export interface ChatSession {
    id: string;
    name: string;
    messages: ChatMessage[];
    createdAt: Date;
    updatedAt: Date;
}

export class SessionManager {
    private sessions: Map<string, ChatSession> = new Map();
    private activeSessionId: string | null = null;
    private context: vscode.ExtensionContext;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.loadSessions();
    }

    public createNewSession(name: string): ChatSession {
        const session: ChatSession = {
            id: Date.now().toString(),
            name: name,
            messages: [],
            createdAt: new Date(),
            updatedAt: new Date()
        };

        this.sessions.set(session.id, session);
        this.activeSessionId = session.id;
        this.saveSessions();
        return session;
    }

    public removeSession(sessionId: string): boolean {
        if (this.sessions.has(sessionId)) {
            this.sessions.delete(sessionId);
            if (this.activeSessionId === sessionId) {
                this.activeSessionId = null;
                // If there are other sessions, set the first one as active
                const remainingSessions = Array.from(this.sessions.keys());
                if (remainingSessions.length > 0) {
                    this.activeSessionId = remainingSessions[0];
                }
            }
            this.saveSessions();
            return true;
        }
        return false;
    }

    public setActiveSession(sessionId: string): boolean {
        if (this.sessions.has(sessionId)) {
            this.activeSessionId = sessionId;
            return true;
        }
        return false;
    }

    public getActiveSession(): ChatSession | null {
        if (this.activeSessionId && this.sessions.has(this.activeSessionId)) {
            return this.sessions.get(this.activeSessionId)!;
        }
        return null;
    }

    public getAllSessions(): ChatSession[] {
        return Array.from(this.sessions.values()).sort((a, b) => 
            b.updatedAt.getTime() - a.updatedAt.getTime()
        );
    }

    public getSession(sessionId: string): ChatSession | null {
        return this.sessions.get(sessionId) || null;
    }

    public addMessage(sessionId: string, content: string, isUser: boolean): ChatMessage | null {
        const session = this.sessions.get(sessionId);
        if (!session) {
            return null;
        }

        const message: ChatMessage = {
            id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
            content: content,
            isUser: isUser,
            timestamp: new Date()
        };

        session.messages.push(message);
        session.updatedAt = new Date();
        this.saveSessions();
        return message;
    }

    public renameSession(sessionId: string, newName: string): boolean {
        const session = this.sessions.get(sessionId);
        if (session) {
            session.name = newName;
            session.updatedAt = new Date();
            this.saveSessions();
            return true;
        }
        return false;
    }

    public clearSession(sessionId: string): boolean {
        const session = this.sessions.get(sessionId);
        if (session) {
            session.messages = [];
            session.updatedAt = new Date();
            this.saveSessions();
            return true;
        }
        return false;
    }

    private loadSessions(): void {
        try {
            const savedSessions = this.context.globalState.get<{[key: string]: any}>('aiAssistant.sessions', {});
            const savedActiveSessionId = this.context.globalState.get<string>('aiAssistant.activeSessionId', '');

            // Convert saved data to ChatSession objects
            for (const [id, data] of Object.entries(savedSessions)) {
                const session: ChatSession = {
                    id: data.id,
                    name: data.name,
                    messages: data.messages.map((msg: any) => ({
                        ...msg,
                        timestamp: new Date(msg.timestamp)
                    })),
                    createdAt: new Date(data.createdAt),
                    updatedAt: new Date(data.updatedAt)
                };
                this.sessions.set(id, session);
            }

            // Restore active session
            if (savedActiveSessionId && this.sessions.has(savedActiveSessionId)) {
                this.activeSessionId = savedActiveSessionId;
            }

            // If there are no sessions, create a default session
            if (this.sessions.size === 0) {
                this.createNewSession('Default Session');
            }
        } catch (error) {
            console.error('Error loading sessions:', error);
            // If loading fails, create a default session
            this.createNewSession('Default Session');
        }
    }

    private saveSessions(): void {
        try {
            // Convert sessions Map to a plain object for saving
            const sessionsObj: {[key: string]: any} = {};
            for (const [id, session] of this.sessions) {
                sessionsObj[id] = {
                    id: session.id,
                    name: session.name,
                    messages: session.messages,
                    createdAt: session.createdAt.toISOString(),
                    updatedAt: session.updatedAt.toISOString()
                };
            }

            this.context.globalState.update('aiAssistant.sessions', sessionsObj);
            this.context.globalState.update('aiAssistant.activeSessionId', this.activeSessionId);
        } catch (error) {
            console.error('Error saving sessions:', error);
        }
    }

    public exportSession(sessionId: string): string | null {
        const session = this.sessions.get(sessionId);
        if (!session) {
            return null;
        }

        const exportData = {
            name: session.name,
            createdAt: session.createdAt,
            messages: session.messages
        };

        return JSON.stringify(exportData, null, 2);
    }

    public importSession(jsonData: string): ChatSession | null {
        try {
            const data = JSON.parse(jsonData);
            const session: ChatSession = {
                id: Date.now().toString(),
                name: data.name || 'Imported Session',
                messages: data.messages || [],
                createdAt: new Date(data.createdAt) || new Date(),
                updatedAt: new Date()
            };

            this.sessions.set(session.id, session);
            this.saveSessions();
            return session;
        } catch (error) {
            console.error('Error importing session:', error);
            return null;
        }
    }
}