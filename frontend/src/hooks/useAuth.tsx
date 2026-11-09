import React, { createContext, useContext, useState, useEffect } from 'react';

export interface User {
    user_id: string;
    name: string;
    username: string;
    role: 'admin' | 'accountant' | 'project_head' | 'site_engineer' | 'sales' | 'd1' | 'd2' | 'mmt' | 'site_inspection' | 'site_inspector' | 'project_manager' | 'manager' | 'graphic_designer' | 'gd' | 'business_associate';
    token: string;
    is_admin?: boolean | number;
    [key: string]: any;
}

interface AuthContextType {
    user: User | null;
    login: (userData: User) => void;
    logout: () => void;
    isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(() => {
        const savedUser = localStorage.getItem('Livincart_user') || localStorage.getItem('user');
        if (savedUser) {
            try {
                return JSON.parse(savedUser);
            } catch (e) {
                return null;
            }
        }
        return null;
    });

    const login = (userData: User) => {
        setUser(userData);
        localStorage.setItem("Livincart_user", JSON.stringify(userData));
        localStorage.setItem("user", JSON.stringify(userData));
    };

    const logout = () => {
        setUser(null);
        localStorage.removeItem('Livincart_user');
        localStorage.removeItem('user');
    };

    return (
        <AuthContext.Provider value={{ user, login, logout, isAuthenticated: !!user }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
