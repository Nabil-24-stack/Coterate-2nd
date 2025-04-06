"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import supabaseService from '@/services/SupabaseService';
import { LoadingSpinner } from '@/components/LoadingSpinner';

type MigrationStatus = {
  status: 'idle' | 'checking' | 'migrating' | 'success' | 'error';
  message: string;
  progress: number;
  details?: {
    migratedDesigns?: number;
    migratedIterations?: number;
  };
};

export default function MigratePage() {
  const router = useRouter();
  const [migrationStatus, setMigrationStatus] = useState<MigrationStatus>({
    status: 'idle',
    message: 'Checking system status...',
    progress: 0
  });
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  // Check if the user is authenticated
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const session = await supabaseService.getSession();
        setIsAuthenticated(!!session);
      } catch (error) {
        console.error('Error checking authentication:', error);
        setIsAuthenticated(false);
      }
    };
    
    checkAuth();
  }, []);

  // Start the migration process
  const handleMigrate = async () => {
    try {
      setMigrationStatus({
        status: 'migrating',
        message: 'Starting migration. This may take a few minutes...',
        progress: 10
      });

      // Wait a bit to show the UI update
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setMigrationStatus(prev => ({
        ...prev,
        message: 'Migrating designs and iterations to the new database structure...',
        progress: 30
      }));

      // Perform the migration
      const result = await supabaseService.migrateToNormalizedSchema();
      
      if (result.success) {
        setMigrationStatus({
          status: 'success',
          message: result.message,
          progress: 100,
          details: {
            migratedDesigns: result.migratedDesigns,
            migratedIterations: result.migratedIterations
          }
        });
      } else {
        setMigrationStatus({
          status: 'error',
          message: result.message || 'An unknown error occurred during migration.',
          progress: 0
        });
      }
    } catch (error) {
      console.error('Migration error:', error);
      setMigrationStatus({
        status: 'error',
        message: 'An unexpected error occurred during the migration process.',
        progress: 0
      });
    }
  };

  // Redirect to the app after successful migration
  const handleContinue = () => {
    router.push('/');
  };

  if (isAuthenticated === null) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner />
      </div>
    );
  }

  if (isAuthenticated === false) {
    return (
      <div className="container mx-auto max-w-4xl py-8 px-4">
        <Card>
          <CardHeader>
            <CardTitle>Authentication Required</CardTitle>
            <CardDescription>
              You need to be logged in to migrate your data.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Alert variant="destructive">
              <AlertTitle>Not Authenticated</AlertTitle>
              <AlertDescription>
                Please log in to access the data migration tools.
              </AlertDescription>
            </Alert>
          </CardContent>
          <CardFooter>
            <Button onClick={() => router.push('/login')}>Go to Login</Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-4xl py-8 px-4">
      <Card>
        <CardHeader>
          <CardTitle>Database Migration Tool</CardTitle>
          <CardDescription>
            This tool will migrate your existing designs and iterations to the new database structure.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="mb-6">
              <p className="text-sm text-gray-500 mb-2">
                We've improved our database structure to provide better performance and more features.
                This migration will move your existing designs and iterations to the new structure.
              </p>
              <p className="text-sm text-gray-500 mb-2">
                <strong>Important:</strong> This process cannot be undone. We recommend backing up your data before proceeding.
              </p>
            </div>

            {migrationStatus.status === 'migrating' && (
              <div className="space-y-2">
                <p>{migrationStatus.message}</p>
                <Progress value={migrationStatus.progress} className="h-2" />
              </div>
            )}

            {migrationStatus.status === 'success' && (
              <Alert>
                <AlertTitle>Migration Complete</AlertTitle>
                <AlertDescription>
                  <p>{migrationStatus.message}</p>
                  {migrationStatus.details && (
                    <ul className="list-disc ml-5 mt-2">
                      <li>Migrated Designs: {migrationStatus.details.migratedDesigns}</li>
                      <li>Migrated Iterations: {migrationStatus.details.migratedIterations}</li>
                    </ul>
                  )}
                </AlertDescription>
              </Alert>
            )}

            {migrationStatus.status === 'error' && (
              <Alert variant="destructive">
                <AlertTitle>Migration Failed</AlertTitle>
                <AlertDescription>{migrationStatus.message}</AlertDescription>
              </Alert>
            )}
          </div>
        </CardContent>
        <CardFooter className="flex justify-between">
          {migrationStatus.status === 'success' ? (
            <Button onClick={handleContinue}>Continue to App</Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => router.push('/')}>
                Cancel
              </Button>
              <Button 
                onClick={handleMigrate}
                disabled={migrationStatus.status === 'migrating'}
              >
                {migrationStatus.status === 'migrating' ? (
                  <>
                    <span className="mr-2">Migrating...</span>
                    <LoadingSpinner size="sm" />
                  </>
                ) : (
                  'Start Migration'
                )}
              </Button>
            </>
          )}
        </CardFooter>
      </Card>
    </div>
  );
} 