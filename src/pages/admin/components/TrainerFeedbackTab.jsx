import React, { useMemo, useState } from 'react';
import { useAdminData } from '@/contexts/AdminDataContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  Star, 
  Calendar, 
  MapPin, 
  Search, 
  ExternalLink,
  Clock,
  Users
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const TrainerFeedbackTab = () => {
  const { sessions, trainers } = useAdminData();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');

  // 1. Get Recent Sessions (Last 20 Days)
  const recentSessions = useMemo(() => {
    const twentyDaysAgo = new Date();
    twentyDaysAgo.setDate(twentyDaysAgo.getDate() - 20);
    twentyDaysAgo.setHours(0, 0, 0, 0);

    return sessions
      .filter(s => {
        const sessionDate = new Date(s.sessionDate);
        return sessionDate >= twentyDaysAgo;
      })
      .sort((a, b) => new Date(b.sessionDate) - new Date(a.sessionDate));
  }, [sessions]);

  // 2. Trainer Analytics (Trainers who have visited this college)
  const trainerAnalytics = useMemo(() => {
    const analytics = [];
    
    // Identify trainers who have ANY sessions at this college (all time)
    const collegeTrainerIds = new Set(sessions.flatMap(s => (s.assignedTrainers || (s.assignedTrainer ? [s.assignedTrainer] : [])).map(t => t.id)).filter(Boolean));

    collegeTrainerIds.forEach(trainerId => {
      const trainer = trainers.find(t => t.id === trainerId);
      const trainerSessions = sessions.filter(s => (s.assignedTrainers || (s.assignedTrainer ? [s.assignedTrainer] : [])).some(t => t.id === trainerId));
      
      // Calculate stats
      let totalRatingSum = 0;
      let totalRatingCount = 0;
      let totalResponses = 0;

      trainerSessions.forEach(s => {
        if (s.compiledStats) {
          const cs = s.compiledStats;
          totalResponses += cs.totalResponses || 0;
          Object.entries(cs.ratingDistribution || {}).forEach(([rating, count]) => {
            totalRatingSum += Number(rating) * count;
            totalRatingCount += count;
          });
        }
      });

      const avgRating = totalRatingCount > 0 ? (totalRatingSum / totalRatingCount).toFixed(2) : '0.00';

      analytics.push({
        id: trainerId,
        name: trainer?.name || 'Unknown Trainer',
        email: trainer?.email,
        specialisation: trainer?.specialisation || 'N/A',
        totalSessions: trainerSessions.length,
        totalResponses,
        avgRating,
        lastVisit: trainerSessions.length > 0 
          ? trainerSessions.sort((a, b) => new Date(b.sessionDate) - new Date(a.sessionDate))[0].sessionDate
          : 'N/A'
      });
    });

    return analytics.sort((a, b) => b.avgRating - a.avgRating);
  }, [sessions, trainers]);

  // Filter trainers by search term
  const filteredTrainers = useMemo(() => {
      return trainerAnalytics.filter(t => 
        t.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        t.specialisation.toLowerCase().includes(searchTerm.toLowerCase())
      );
  }, [trainerAnalytics, searchTerm]);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">Trainer Feedback</h1>
        <p className="text-muted-foreground">Recent activity and trainer performance analytics.</p>
      </div>

      {/* Recent Sessions Section */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Clock className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold">Recent Sessions (Last 20 Days)</h2>
        </div>
        
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {recentSessions.length === 0 ? (
            <div className="col-span-full text-center py-8 border border-dashed rounded-lg text-muted-foreground">
              No sessions in the last 20 days.
            </div>
          ) : (
            recentSessions.map(session => {
              const cs = session.compiledStats;
              const avgRating = cs && cs.totalResponses > 0 
                ? (Object.entries(cs.ratingDistribution || {}).reduce((acc, [r, c]) => acc + Number(r) * c, 0) / cs.totalResponses).toFixed(1)
                : 'N/A';
                
              return (
                <Card key={session.id} className="hover:bg-muted/30 transition-colors">
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <Badge variant={session.status === 'active' ? 'default' : 'secondary'}>{session.status}</Badge>
                      <div className="flex items-center gap-1 text-sm font-medium">
                        <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                        {avgRating}
                      </div>
                    </div>
                    <CardTitle className="text-base mt-2 line-clamp-1">{session.topic}</CardTitle>
                    <CardDescription className="flex items-center gap-2 text-xs">
                       <Calendar className="h-3 w-3" />
                       {new Date(session.sessionDate).toLocaleDateString()}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm space-y-1">
                      <p className="text-muted-foreground">Trainer: <span className="text-foreground font-medium">{(session.assignedTrainers || (session.assignedTrainer ? [session.assignedTrainer] : [])).map(t => t.name).join(", ")}</span></p>
                      <p className="text-muted-foreground">Responses: <span className="text-foreground">{cs?.totalResponses || 0}</span></p>
                      <Button 
                        variant="link" 
                        className="p-0 h-auto text-xs mt-2"
                        onClick={() => navigate(`/admin/sessions/${session.id}/responses`)}
                      >
                        View Details <ExternalLink className="h-3 w-3 ml-1" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </section>

      {/* Trainer Analytics Section */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold">Trainer Analytics</h2>
          </div>
          <div className="w-64">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search trainers..." 
                className="pl-8"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Trainer</TableHead>
                  <TableHead>Specialisation</TableHead>
                  <TableHead className="text-center">Sessions</TableHead>
                  <TableHead className="text-center">Responses</TableHead>
                  <TableHead className="text-center">Avg Rating</TableHead>
                  <TableHead>Last Visit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTrainers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No trainers found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTrainers.map((trainer) => (
                    <TableRow key={trainer.id}>
                      <TableCell className="font-medium">
                        <div>
                          {trainer.name}
                          {trainer.email && <p className="text-xs text-muted-foreground font-normal">{trainer.email}</p>}
                        </div>
                      </TableCell>
                      <TableCell>{trainer.specialisation}</TableCell>
                      <TableCell className="text-center">{trainer.totalSessions}</TableCell>
                      <TableCell className="text-center">{trainer.totalResponses}</TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1 font-bold">
                          {trainer.avgRating}
                          <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                        </div>
                      </TableCell>
                      <TableCell>
                        {trainer.lastVisit !== 'N/A' 
                          ? new Date(trainer.lastVisit).toLocaleDateString() 
                          : 'N/A'
                        }
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>
    </div>
  );
};

export default TrainerFeedbackTab;
