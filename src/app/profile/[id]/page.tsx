"use client";

import { useEffect, useState } from 'react';
import Navbar from '@/components/layout/Navbar';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import Link from 'next/link';
import { BsBehance, BsDribbble, BsLinkedin, BsInstagram } from 'react-icons/bs';
import { FaGithub, FaTwitter, FaFacebook } from 'react-icons/fa';
import { FiCalendar, FiMail, FiMapPin, FiLink } from 'react-icons/fi';
import type { IconType } from 'react-icons';

export default function ProfilePage({ params }: { params: { id: string } }) {
  const { id } = params;
  const supabase = createClientComponentClient();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', id)
        .maybeSingle();
      setProfile(data || null);
      setLoading(false);
    };
    load();
  }, [id, supabase]);

  const deriveProfileDetails = (details: any) => {
    if (!details) {
      return {
        contactDisplay: '—',
        joinedDate: '—',
        socialLinks: {} as Record<string, string>,
      };
    }

    const rawContact = `${details.contact || details.email || ''}`.trim();
    const pullFrom = (candidate: string | null | undefined, pattern: RegExp) => {
      if (candidate && pattern.test(candidate)) {
        return candidate;
      }
      const match = rawContact.match(pattern);
      return match?.[0] || '';
    };

    const socialLinks: Record<string, string> = {
      behance: pullFrom(details.behance, /https?:\/\/[^\s]*behance[^\s]*/i),
      dribbble: pullFrom(details.dribbble, /https?:\/\/[^\s]*dribbble[^\s]*/i),
      linkedin: pullFrom(details.linkedin, /https?:\/\/[^\s]*linkedin[^\s]*/i),
      instagram: pullFrom(details.instagram, /https?:\/\/[^\s]*instagram[^\s]*/i),
      facebook: pullFrom(details.facebook, /https?:\/\/[^\s]*facebook[^\s]*/i),
      github: pullFrom(details.github, /https?:\/\/[^\s]*github[^\s]*/i),
      twitter: pullFrom(details.twitter, /https?:\/\/[^\s]*twitter[^\s]*/i),
      website: '',
    };

    const genericUrls = Array.from(rawContact.matchAll(/https?:\/\/[^\s]+/gi)).map((match) => match[0]);
    const fallbackWebsite =
      details.website || genericUrls.find((url) => !/(behance|dribbble|linkedin|instagram|facebook|github|twitter)/i.test(url)) || '';
    if (fallbackWebsite) {
      socialLinks.website = fallbackWebsite;
    }

    let sanitizedContact = rawContact;
    Object.values(socialLinks).forEach((url) => {
      if (url) {
        sanitizedContact = sanitizedContact.replace(url, ' ');
      }
    });
    sanitizedContact = sanitizedContact.replace(/\s{2,}/g, ' ').trim();

    const joinedDate = details.created_at
      ? new Date(details.created_at).toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })
      : '—';

    return {
      contactDisplay: sanitizedContact || '—',
      joinedDate,
      socialLinks,
    };
  };

  const { contactDisplay, joinedDate, socialLinks } = deriveProfileDetails(profile);

  const socialLinkDefinitions: Record<
    keyof typeof socialLinks,
    { icon: IconType; colorClass: string; label: string }
  > = {
    behance: { icon: BsBehance, colorClass: 'text-[#1769FF]', label: 'Behance' },
    dribbble: { icon: BsDribbble, colorClass: 'text-[#EA4C89]', label: 'Dribbble' },
    linkedin: { icon: BsLinkedin, colorClass: 'text-[#0A66C2]', label: 'LinkedIn' },
    instagram: { icon: BsInstagram, colorClass: 'text-[#C13584]', label: 'Instagram' },
    facebook: { icon: FaFacebook, colorClass: 'text-[#0866FF]', label: 'Facebook' },
    github: { icon: FaGithub, colorClass: 'text-slate-900', label: 'GitHub' },
    twitter: { icon: FaTwitter, colorClass: 'text-[#1DA1F2]', label: 'Twitter / X' },
    website: { icon: FiLink, colorClass: 'text-primary', label: 'Website' },
  };

  const visibleSocialLinks = Object.entries(socialLinks).filter(([, url]) => Boolean(url)) as [keyof typeof socialLinks, string][];

  return (
    <div className="min-h-[100svh] bg-white text-slate-900">
      <Navbar />
      <div className="relative overflow-hidden">
        <div className="relative mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
          {loading ? (
            <div className="flex h-64 items-center justify-center">
              <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-t-2 border-primary"></div>
            </div>
          ) : !profile ? (
            <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-500 shadow-xl">
              Profile not found.
            </div>
          ) : (
            <section className="relative overflow-hidden rounded-[32px] border border-slate-200 bg-white text-slate-900 shadow-2xl">
              <div
                className="absolute inset-x-0 top-0 h-44 bg-gradient-to-r from-slate-100 via-white to-slate-100"
                aria-hidden="true"
              />

              <header className="relative px-6 pb-12 pt-14 sm:px-10 sm:pt-16">
                <div className="flex flex-col gap-8 sm:flex-row sm:items-end sm:justify-between">
                  <div className="flex flex-col items-center text-center sm:flex-row sm:items-end sm:gap-6 sm:text-left">
                    <div className="h-28 w-28 overflow-hidden rounded-full border-4 border-white bg-gray-100 shadow-xl">
                      {profile.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={profile.avatar_url} alt={profile.full_name || 'Avatar'} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-white text-3xl font-semibold text-primary">
                          {(profile.full_name?.charAt(0) || 'U').toUpperCase()}
                        </div>
                      )}
                    </div>

                    <div className="mt-6 space-y-4 sm:mt-0">
                      <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
                        <span className="inline-flex items-center rounded-full bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.35em] text-primary shadow-sm">
                          Profile
                        </span>
                        {profile.role && (
                          <span className="inline-flex items-center rounded-full bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.35em] text-slate-600 shadow-sm">
                            {profile.role}
                          </span>
                        )}
                      </div>
                      <div>
                        <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl">
                          {profile.full_name || 'User'}
                        </h1>
                        {profile.title && (
                          <p className="mt-2 text-base text-slate-600">{profile.title}</p>
                        )}
                      </div>
                      <div className="flex flex-wrap justify-center gap-3 text-sm text-slate-600 sm:justify-start">
                        {profile.place && (
                          <span className="inline-flex items-center gap-2 rounded-full bg-slate-50 px-3 py-1 shadow-sm">
                            <FiMapPin className="h-4 w-4 text-primary" />
                            {profile.place}
                          </span>
                        )}
                        {joinedDate !== '—' && (
                          <span className="inline-flex items-center gap-2 rounded-full bg-slate-50 px-3 py-1 shadow-sm">
                            <FiCalendar className="h-4 w-4 text-primary" />
                            Joined {joinedDate}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {visibleSocialLinks.length > 0 && (
                    <div className="flex flex-wrap justify-center gap-3 sm:justify-end">
                      {visibleSocialLinks.map(([key, url]) => {
                        const config = socialLinkDefinitions[key];
                        if (!config) return null;
                        const Icon = config.icon;
                        return (
                          <Link
                            key={key}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:bg-primary/5"
                          >
                            <Icon className={`h-5 w-5 transition group-hover:scale-110 ${config.colorClass}`} />
                            <span>{config.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              </header>

              <div className="border-t border-slate-200 bg-white px-6 py-10 sm:px-10">
                <div className="grid gap-8 lg:grid-cols-[2fr_1fr]">
                  <section>
                    <h2 className="text-xs font-semibold uppercase tracking-[0.4em] text-slate-500">
                      About
                    </h2>
                    <p className="mt-4 whitespace-pre-line text-base leading-relaxed text-slate-700">
                      {profile.bio || "This creative hasn’t added a bio just yet."}
                    </p>
                  </section>

                  <aside className="rounded-3xl border border-slate-200 bg-white px-6 py-6 shadow-sm">
                    <h3 className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-500">
                      Details
                    </h3>
                    <dl className="mt-5 space-y-4 text-sm text-slate-600">
                      <div>
                        <dt className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
                          <FiMapPin className="h-4 w-4 text-primary" />
                          Location
                        </dt>
                        <dd className="mt-1 text-base text-slate-700">
                          {profile.place || '—'}
                        </dd>
                      </div>
                      <div>
                        <dt className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
                          <FiMail className="h-4 w-4 text-primary" />
                          Contact
                        </dt>
                        <dd className="mt-1 text-base text-slate-700">
                          {contactDisplay}
                        </dd>
                      </div>
                      <div>
                        <dt className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
                          <FiCalendar className="h-4 w-4 text-primary" />
                          Joined
                        </dt>
                        <dd className="mt-1 text-base text-slate-700">
                          {joinedDate}
                        </dd>
                      </div>
                    </dl>
                  </aside>
                </div>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
