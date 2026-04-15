import React from "react";
import { Link } from "react-router-dom";
import {
  Shield,
  LogIn,
  ClipboardCheck,
  BarChart3,
  Building2,
  GraduationCap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import ImageComparison from "./new";

const collegeLogos = [
  "Collegelogo1.png",
  "College logo2.png",
  "Collegelogo3.png",
  "Collegelogo4.png",
  "Collegelogo5.png",
  "Collegelogo6.png",
  "Collegelogo7.png",
  "Collegelogo8.png",
  "Collegelogo9.png",
  "Collegelogo10.png",
  "Collegelogo11.png",
  "Collegelogo12.png",
  "Collegelogo13.png",
  "Collegelogo14.png",
  "Collegelogo15.png",
  "Collegelogo16.png",
  "Collegelogo17.png",
  "Collegelogo18.avif",
  "Collegelogo19.avif",
  "Collegelogo20.avif",
  "Collegelogo21.avif",
  "Collegelogo22.avif",
  "Collegelogo23.avif",
  "Collegelogo24.avif",
  "Collegelogo25.avif",
  "Collegelogo26.avif",
  "Collegelogo27.avif",
  "Collegelogo28.avif",
  "Collegelogo29.png",
].map((name) => `/CollegeLogo/${name}`);

const features = [
  {
    icon: ClipboardCheck,
    title: "Anonymous Feedback",
    description:
      "Students can provide honest feedback through secure session links without revealing their identity.",
  },
  {
    icon: BarChart3,
    title: "Comprehensive Analytics",
    description:
      "Detailed reports and visualizations help administrators understand training effectiveness.",
  },
  {
    icon: Shield,
    title: "Role-Based Access",
    description:
      "Secure multi-level dashboards for super admins, college admins, and trainers.",
  },
  {
    icon: GraduationCap,
    title: "Customizable Surveys",
    description:
      "Design feedback forms specific to each session or course with ease.",
  },
];

export const Landing = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section Wrapper */}
      <section className="min-h-screen flex flex-col relative overflow-hidden">
        {/* Navigation */}
        <nav className="fixed top-0 left-0 right-0 z-50 bg-primary shadow-md">
          <div className="container mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <img
                  src="/logo.png"
                  alt="Gryphon Academy"
                  className="h-12 md:h-16 w-auto object-contain"
                />
              </div>

              <div>
                <Link to="/login">
                  <Button className="bg-white text-primary hover:bg-white/90 px-8 py-2 font-medium">
                    Login <LogIn className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </nav>

        {/* Main Content Area (Hero) */}
        <main className="flex-1 flex flex-col justify-center items-center relative z-10 pt-24 md:pt-32">
          {/* Background Decoration */}
          <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none" />
          <div className="absolute top-1/2 left-10 w-64 h-64 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute top-1/3 right-10 w-96 h-96 bg-accent/5 rounded-full blur-3xl pointer-events-none" />

          <div className="container mx-auto px-6 text-center max-w-4xl">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-3 md:mb-4 animate-fade-up">
              <Shield className="h-4 w-4" />
              Secure & Anonymous Feedback Platform
            </div>

            <h1
              className="font-display text-3xl md:text-4xl lg:text-5xl font-bold text-foreground leading-tight mb-4 animate-fade-up"
              style={{ animationDelay: "0.1s" }}
            >
              Elevate Training
              <br />
              Excellence Through
              <br />
              <span className="text-white bg-primary rounded-3xl px-6 py-2 mt-2 inline-block">
                Meaningful Feedback
              </span>
            </h1>

            <p
              className="text-lg text-muted-foreground mb-6 max-w-2xl mx-auto animate-fade-up"
              style={{ animationDelay: "0.2s" }}
            >
              Empower your institution with a comprehensive feedback system that
              bridges the gap between students and trainers, fostering
              continuous improvement in education.
            </p>
          </div>
        </main>

        {/* Marquee Section */}
        <div className="bg-secondary/30 pt-4 pb-8 border-t border-border z-20">
          <h3 className="text-center font-display text-xl font-semibold mb-4 text-muted-foreground">
            Trusted by Leading Institutions
          </h3>
          <div className="w-full overflow-hidden">
            <div className="flex w-max animate-marquee">
              {/* First Set of Logos */}
              <div className="flex items-center gap-8 px-3">
                {collegeLogos.map((logo, index) => (
                  <div
                    key={`l1-${index}`}
                    className="h-20 w-auto flex-shrink-0 transition-all duration-300 hover:scale-105 bg-white rounded-3xl border-4 border-white shadow-sm overflow-hidden"
                  >
                    <img
                      src={logo}
                      alt={`College Logo ${index}`}
                      className="h-full w-auto object-contain"
                    />
                  </div>
                ))}
              </div>
              {/* Duplicate Set for Seamless Loop */}
              <div className="flex items-center gap-8 px-3">
                {collegeLogos.map((logo, index) => (
                  <div
                    key={`l2-${index}`}
                    className="h-20 w-auto flex-shrink-0 transition-all duration-300 hover:scale-105 bg-white rounded-3xl border-4 border-white shadow-sm overflow-hidden"
                  >
                    <img
                      src={logo}
                      alt={`College Logo ${index}`}
                      className="h-full w-auto object-contain"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section (Restored) */}
      <section id="features" className="py-20 px-6 bg-background">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-4">
              Everything You Need
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              A complete feedback management solution designed for educational
              institutions
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => (
              <div
                key={feature.title}
                className="glass-card rounded-xl p-6 hover:shadow-lg transition-all duration-300"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-white mb-4">
                  <feature.icon className="h-6 w-6" />
                </div>
                <h3 className="font-display text-lg font-semibold text-foreground mb-2">
                  {feature.title}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer (Restored) */}
      <footer className="border-t border-border py-12 px-6 bg-primary text-white">
        <div className="container mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <img
                src="/logo.png"
                alt="Gryphon Academy"
                className="h-20 w-auto object-contain"
              />
            </div>
            <p className="text-sm text-white/70">
              © {new Date().getFullYear()} Gryphon Academy Pvt Ltd. All rights
              reserved.
            </p>
          </div>
        </div>
      </footer>
      {/* <ImageComparison /> */}
    </div>
  );
};
