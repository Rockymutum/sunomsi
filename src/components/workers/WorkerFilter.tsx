"use client";

import { useState, useEffect } from 'react';

const SKILLS = [
  'Cleaning',
  'Delivery',
  'Handyman',
  'Moving',
  'Technology',
  'Design',
  'Writing',
  'Cooking',
  'Gardening',
  'Other'
];

interface WorkerFilterProps {
  onFilterChange: (filters: any) => void;
  filters?: {
    skills?: string[] | string;
    minRating?: number | string;
    location?: string;
    searchTerm?: string;
  };
  onClearFilters?: () => void;
  compact?: boolean;
}

export default function WorkerFilter({ onFilterChange, filters, onClearFilters, compact }: WorkerFilterProps) {
  const [skills, setSkills] = useState('');
  const [minRating, setMinRating] = useState('');
  const [location, setLocation] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Initialize from incoming filters if provided
  // (stringify skills if array)
  useEffect(() => {
    if (filters) {
      setSkills(Array.isArray(filters.skills) ? (filters.skills[0] || '') : (filters.skills || ''));
      setMinRating(filters.minRating !== undefined && filters.minRating !== null ? String(filters.minRating) : '');
      setLocation(filters.location || '');
      setSearchTerm(filters.searchTerm || '');
    }
  }, [filters]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onFilterChange({
      skills,
      minRating,
      location,
      searchTerm
    });
  };

  const clearFilters = () => {
    setSkills('');
    setMinRating('');
    setLocation('');
    setSearchTerm('');
    onFilterChange({
      skills: '',
      minRating: '',
      location: '',
      searchTerm: ''
    });
    if (onClearFilters) onClearFilters();
  };

  return (
    <div className={`bg-white ${compact ? 'p-3' : 'p-4'} rounded-lg shadow-md`}>
      <h2 className={`${compact ? 'text-base mb-3' : 'text-lg mb-4'} font-semibold`}>Filter Workers</h2>
      
      <form onSubmit={handleSubmit} className={compact ? 'text-sm' : ''}>
        <div className={compact ? 'mb-2' : 'mb-4'}>
          <label htmlFor="search" className={`block ${compact ? 'text-xs' : 'text-sm'} font-medium text-gray-700 ${compact ? 'mb-0.5' : 'mb-1'}`}>
            Search
          </label>
          <input
            type="text"
            id="search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search workers..."
            className={`input-field ${compact ? 'py-1 px-2 text-sm' : ''}`}
          />
        </div>
        
        <div className={compact ? 'mb-2' : 'mb-4'}>
          <label htmlFor="skills" className={`block ${compact ? 'text-xs' : 'text-sm'} font-medium text-gray-700 ${compact ? 'mb-0.5' : 'mb-1'}`}>
            Skills
          </label>
          <select
            id="skills"
            value={skills}
            onChange={(e) => setSkills(e.target.value)}
            className={`input-field ${compact ? 'py-1 px-2 text-sm' : ''}`}
          >
            <option value="">All Skills</option>
            {SKILLS.map((skill) => (
              <option key={skill} value={skill}>
                {skill}
              </option>
            ))}
          </select>
        </div>
        
        <div className={compact ? 'mb-2' : 'mb-4'}>
          <label htmlFor="location" className={`block ${compact ? 'text-xs' : 'text-sm'} font-medium text-gray-700 ${compact ? 'mb-0.5' : 'mb-1'}`}>
            Location
          </label>
          <input
            type="text"
            id="location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Any location"
            className={`input-field ${compact ? 'py-1 px-2 text-sm' : ''}`}
          />
        </div>
        
        <div className={compact ? 'mb-2' : 'mb-4'}>
          <label htmlFor="minRating" className={`block ${compact ? 'text-xs' : 'text-sm'} font-medium text-gray-700 ${compact ? 'mb-0.5' : 'mb-1'}`}>
            Minimum Rating
          </label>
          <select
            id="minRating"
            value={minRating}
            onChange={(e) => setMinRating(e.target.value)}
            className={`input-field ${compact ? 'py-1 px-2 text-sm' : ''}`}
          >
            <option value="">Any Rating</option>
            <option value="4.5">4.5+ Stars</option>
            <option value="4">4+ Stars</option>
            <option value="3.5">3.5+ Stars</option>
            <option value="3">3+ Stars</option>
          </select>
        </div>
        
        <div className="flex space-x-2">
          <button type="submit" className={`btn-primary flex-1 ${compact ? 'py-1 text-sm' : ''}`}>
            Apply Filters
          </button>
          <button
            type="button"
            onClick={clearFilters}
            className={`px-4 ${compact ? 'py-1 text-sm' : 'py-2'} border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50`}
          >
            Clear
          </button>
        </div>
      </form>
    </div>
  );
}