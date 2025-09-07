import * as assert from 'assert';
import * as vscode from 'vscode';
import { SessionManager, ChatSession, ChatMessage } from '../services/session/sessionManager';

suite('SessionManager Test Suite', () => {
    let sessionManager: SessionManager;
    let mockContext: any;

    setup(() => {
        // Create mock extension context
        mockContext = {
            subscriptions: [],
            globalState: {
                get: (key: string) => {
                    if (key === 'aiAssistant.sessions') {
                        return {
                            'test-session-1': {
                                id: 'test-session-1',
                                name: 'Test Session 1',
                                messages: [],
                                createdAt: new Date().toISOString(),
                                updatedAt: new Date().toISOString()
                            },
                            'test-session-2': {
                                id: 'test-session-2',
                                name: 'Test Session 2',
                                messages: [],
                                createdAt: new Date().toISOString(),
                                updatedAt: new Date().toISOString()
                            }
                        };
                    }
                    if (key === 'aiAssistant.activeSessionId') {
                        return 'test-session-1';
                    }
                    return undefined;
                },
                update: () => Promise.resolve(),
                keys: () => ['aiAssistant.sessions', 'aiAssistant.activeSessionId']
            },
            workspaceState: {
                get: () => undefined,
                update: () => Promise.resolve(),
                keys: () => []
            },
            extensionUri: vscode.Uri.file(__dirname),
            asAbsolutePath: (relativePath: string) => relativePath,
            storagePath: '',
            globalStoragePath: '',
            logPath: '',
            extensionPath: '',
            environmentVariableCollection: {} as any,
            extensionMode: vscode.ExtensionMode.Test,
            secrets: {
                get: () => Promise.resolve(undefined),
                store: () => Promise.resolve(),
                delete: () => Promise.resolve()
            },
            storageUri: vscode.Uri.file(''),
            globalStorageUri: vscode.Uri.file(''),
            logUri: vscode.Uri.file(''),
            extensionRuntime: 'node' as any
        };

        sessionManager = new SessionManager(mockContext as vscode.ExtensionContext);
    });

    test('SessionManager should be created successfully', () => {
        assert.ok(sessionManager, 'SessionManager should be created');
        assert.ok(typeof sessionManager.getAllSessions === 'function', 'getAllSessions method should exist');
        assert.ok(typeof sessionManager.createNewSession === 'function', 'createNewSession method should exist');
        assert.ok(typeof sessionManager.removeSession === 'function', 'removeSession method should exist');
        assert.ok(typeof sessionManager.exportSession === 'function', 'exportSession method should exist');
        assert.ok(typeof sessionManager.importSession === 'function', 'importSession method should exist');
    });

    test('getAllSessions should return sessions', () => {
        const sessions = sessionManager.getAllSessions();
        assert.ok(Array.isArray(sessions), 'Sessions should be an array');
        assert.strictEqual(sessions.length, 2, 'Should have 2 test sessions');
        assert.strictEqual(sessions[0].name, 'Test Session 1', 'First session name should match');
        assert.strictEqual(sessions[1].name, 'Test Session 2', 'Second session name should match');
    });

    test('createNewSession should add new session', () => {
        const initialSessions = sessionManager.getAllSessions();
        const initialCount = initialSessions.length;

        const newSession = sessionManager.createNewSession('New Test Session');
        
        assert.ok(newSession, 'New session should be created');
        assert.ok(newSession.id, 'New session should have an ID');
        assert.strictEqual(newSession.name, 'New Test Session', 'Session name should match');
        assert.ok(Array.isArray(newSession.messages), 'Session should have messages array');

        const updatedSessions = sessionManager.getAllSessions();
        assert.strictEqual(updatedSessions.length, initialCount + 1, 'Session count should increase by 1');
    });

    test('removeSession should remove session', () => {
        const sessions = sessionManager.getAllSessions();
        const sessionToDelete = sessions[0];

        const result = sessionManager.removeSession(sessionToDelete.id);
        assert.ok(result, 'Session should be removed successfully');

        const updatedSessions = sessionManager.getAllSessions();
        const deletedSession = updatedSessions.find(s => s.id === sessionToDelete.id);
        assert.strictEqual(deletedSession, undefined, 'Session should be deleted');
    });

    test('renameSession should update session name', () => {
        const sessions = sessionManager.getAllSessions();
        const sessionToRename = sessions[0];
        const newName = 'Renamed Session';

        const result = sessionManager.renameSession(sessionToRename.id, newName);
        assert.ok(result, 'Session should be renamed successfully');

        const updatedSessions = sessionManager.getAllSessions();
        const renamedSession = updatedSessions.find(s => s.id === sessionToRename.id);
        assert.ok(renamedSession, 'Session should still exist');
        assert.strictEqual(renamedSession!.name, newName, 'Session name should be updated');
    });

    test('clearSession should clear messages but keep session', () => {
        const sessions = sessionManager.getAllSessions();
        const sessionToClear = sessions[0];
        
        // Add some messages to the session
        sessionManager.addMessage(sessionToClear.id, 'Hello', true);
        sessionManager.addMessage(sessionToClear.id, 'Hi there!', false);

        const result = sessionManager.clearSession(sessionToClear.id);
        assert.ok(result, 'Session should be cleared successfully');

        const updatedSessions = sessionManager.getAllSessions();
        const clearedSession = updatedSessions.find(s => s.id === sessionToClear.id);
        assert.ok(clearedSession, 'Session should still exist');
        assert.strictEqual(clearedSession!.messages.length, 0, 'Session messages should be cleared');
    });

    test('addMessage should add message to session', () => {
        const sessions = sessionManager.getAllSessions();
        const session = sessions[0];

        const message = sessionManager.addMessage(session.id, 'Test message', true);
        assert.ok(message, 'Message should be added successfully');

        const updatedSessions = sessionManager.getAllSessions();
        const updatedSession = updatedSessions.find(s => s.id === session.id);
        assert.ok(updatedSession, 'Session should exist');
        assert.strictEqual(updatedSession!.messages.length, 1, 'Session should have one message');
        assert.strictEqual(updatedSession!.messages[0].content, 'Test message', 'Message content should match');
        assert.ok(updatedSession!.messages[0].isUser, 'Message should be marked as user message');
    });

    test('getSession should return session by id', () => {
        const sessions = sessionManager.getAllSessions();
        const expectedSession = sessions[0];

        const foundSession = sessionManager.getSession(expectedSession.id);
        
        assert.ok(foundSession, 'Session should be found');
        assert.strictEqual(foundSession!.id, expectedSession.id, 'Session ID should match');
        assert.strictEqual(foundSession!.name, expectedSession.name, 'Session name should match');
    });

    test('getSession should return null for non-existent session', () => {
        const foundSession = sessionManager.getSession('non-existent-id');
        assert.strictEqual(foundSession, null, 'Should return null for non-existent session');
    });

    test('setActiveSession should set active session', () => {
        const sessions = sessionManager.getAllSessions();
        const sessionToActivate = sessions[0];

        const result = sessionManager.setActiveSession(sessionToActivate.id);
        assert.ok(result, 'Active session should be set successfully');

        const activeSession = sessionManager.getActiveSession();
        assert.ok(activeSession, 'Active session should be returned');
        assert.strictEqual(activeSession!.id, sessionToActivate.id, 'Active session ID should match');
    });

    test('getActiveSession should return null when no active session', () => {
        // Remove all sessions
        const sessions = sessionManager.getAllSessions();
        sessions.forEach(session => {
            sessionManager.removeSession(session.id);
        });

        const activeSession = sessionManager.getActiveSession();
        assert.strictEqual(activeSession, null, 'Should return null when no active session');
    });

    test('exportSession should export session data', () => {
        const sessions = sessionManager.getAllSessions();
        const sessionToExport = sessions[0];

        const exportedData = sessionManager.exportSession(sessionToExport.id);
        assert.ok(exportedData, 'Should export session data');
        assert.ok(typeof exportedData === 'string', 'Exported data should be a string');

        try {
            const parsedData = JSON.parse(exportedData);
            assert.ok(parsedData.name, 'Exported data should have name');
            assert.ok(parsedData.createdAt, 'Exported data should have createdAt');
            assert.ok(Array.isArray(parsedData.messages), 'Exported data should have messages array');
        } catch (error) {
            assert.fail('Exported data should be valid JSON');
        }
    });

    test('exportSession should return null for non-existent session', () => {
        const exportedData = sessionManager.exportSession('non-existent-id');
        assert.strictEqual(exportedData, null, 'Should return null for non-existent session');
    });

    test('importSession should import session data', () => {
        const importData = {
            name: 'Imported Session',
            createdAt: new Date().toISOString(),
            messages: [
                {
                    id: 'msg-1',
                    content: 'Hello from import',
                    isUser: true,
                    timestamp: new Date().toISOString()
                }
            ]
        };

        const jsonData = JSON.stringify(importData);
        const importedSession = sessionManager.importSession(jsonData);

        assert.ok(importedSession, 'Should import session successfully');
        assert.ok(importedSession!.id, 'Imported session should have an ID');
        assert.strictEqual(importedSession!.name, 'Imported Session', 'Session name should match');
        assert.strictEqual(importedSession!.messages.length, 1, 'Should have imported messages');

        // Verify session is added to the list
        const allSessions = sessionManager.getAllSessions();
        const foundSession = allSessions.find(s => s.id === importedSession!.id);
        assert.ok(foundSession, 'Imported session should be in the sessions list');
    });

    test('importSession should handle invalid JSON gracefully', () => {
        const invalidJson = 'invalid json data';
        const importedSession = sessionManager.importSession(invalidJson);

        assert.strictEqual(importedSession, null, 'Should return null for invalid JSON');
    });

    test('importSession should handle missing data gracefully', () => {
        const incompleteData = {
            name: 'Incomplete Session'
            // Missing createdAt and messages
        };

        const jsonData = JSON.stringify(incompleteData);
        const importedSession = sessionManager.importSession(jsonData);

        assert.ok(importedSession, 'Should import session with missing data');
        assert.strictEqual(importedSession!.name, 'Incomplete Session', 'Session name should match');
        assert.ok(Array.isArray(importedSession!.messages), 'Should have empty messages array');
        assert.ok(importedSession!.createdAt instanceof Date, 'Should have valid createdAt date');
    });

    test('should handle session with messages', () => {
        const sessions = sessionManager.getAllSessions();
        const session = sessions[0];

        // Add multiple messages
        const message1 = sessionManager.addMessage(session.id, 'User message 1', true);
        const message2 = sessionManager.addMessage(session.id, 'Assistant response 1', false);
        const message3 = sessionManager.addMessage(session.id, 'User message 2', true);

        assert.ok(message1, 'First message should be added');
        assert.ok(message2, 'Second message should be added');
        assert.ok(message3, 'Third message should be added');

        const updatedSession = sessionManager.getSession(session.id);
        assert.ok(updatedSession, 'Session should exist');
        assert.strictEqual(updatedSession!.messages.length, 3, 'Should have 3 messages');

        // Verify message order and content
        assert.strictEqual(updatedSession!.messages[0].content, 'User message 1', 'First message should match');
        assert.ok(updatedSession!.messages[0].isUser, 'First message should be from user');
        assert.strictEqual(updatedSession!.messages[1].content, 'Assistant response 1', 'Second message should match');
        assert.ok(!updatedSession!.messages[1].isUser, 'Second message should be from assistant');
        assert.strictEqual(updatedSession!.messages[2].content, 'User message 2', 'Third message should match');
        assert.ok(updatedSession!.messages[2].isUser, 'Third message should be from user');
    });

    test('should handle session timestamps correctly', () => {
        const sessions = sessionManager.getAllSessions();
        const session = sessions[0];

        const beforeUpdate = session.updatedAt.getTime();
        
        // Add message to update timestamp
        sessionManager.addMessage(session.id, 'Test message', true);
        
        const updatedSession = sessionManager.getSession(session.id);
        assert.ok(updatedSession, 'Session should exist');
        
        const afterUpdate = updatedSession!.updatedAt.getTime();
        assert.ok(afterUpdate >= beforeUpdate, 'Updated timestamp should be newer or equal');
    });

    test('should handle empty session name gracefully', () => {
        const newSession = sessionManager.createNewSession('');
        assert.ok(newSession, 'Should create session with empty name');
        assert.strictEqual(newSession.name, '', 'Session name should be empty string');
    });

    test('should handle special characters in session name', () => {
        const specialName = 'Session with special chars: !@#$%^&*()';
        const newSession = sessionManager.createNewSession(specialName);
        
        assert.ok(newSession, 'Should create session with special characters');
        assert.strictEqual(newSession.name, specialName, 'Session name should preserve special characters');
    });
}); 